CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone)
  VALUES (NEW.id, left(coalesce(NEW.raw_user_meta_data->>'full_name',''),120), coalesce(NEW.email,''),
          left(coalesce(NEW.raw_user_meta_data->>'phone',''),30));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'member');
  -- No automatic admin: only the super admin grants staff access.
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.admin_set_role(_user uuid, _role app_role, _grant boolean)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF _role IN ('member','super_admin') THEN RAISE EXCEPTION 'Invalid role'; END IF;
  IF _role = 'admin' AND NOT public.has_role(auth.uid(),'super_admin') THEN
    RAISE EXCEPTION 'Only the super admin can grant or remove admin access';
  END IF;
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Not authorised'; END IF;
  IF public.has_role(_user,'super_admin') THEN RAISE EXCEPTION 'The super admin account cannot be changed'; END IF;
  IF _grant THEN INSERT INTO public.user_roles (user_id, role) VALUES (_user, _role) ON CONFLICT DO NOTHING;
  ELSE DELETE FROM public.user_roles WHERE user_id = _user AND role = _role; END IF;
  PERFORM public.log_audit(CASE WHEN _grant THEN 'role.granted' ELSE 'role.revoked' END, 'user_role', _user, _user, jsonb_build_object('role', _role));
END $function$;

CREATE OR REPLACE FUNCTION public.admin_list_members(_q text, _status text, _limit integer, _offset integer)
 RETURNS TABLE(id uuid, member_code text, full_name text, email text, phone text, created_at timestamp with time zone, status text, plan_name text, expires_at timestamp with time zone, pending_requests integer, total_count bigint)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
#variable_conflict use_column
DECLARE soon int;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  SELECT g.expiring_soon_days INTO soon FROM public.gym_settings g WHERE g.id = 1;
  RETURN QUERY
  WITH base AS (
    SELECT p.id AS pid, p.member_code AS pcode, p.full_name AS pname, p.email AS pemail, p.phone AS pphone,
      p.created_at AS pcreated, p.access_state AS pstate,
      (SELECT max(m.ends_at) FROM public.membership_periods m WHERE m.member_id = p.id) AS exp,
      (SELECT m.plan_name FROM public.membership_periods m WHERE m.member_id = p.id ORDER BY m.ends_at DESC LIMIT 1) AS pln,
      (SELECT count(*)::int FROM public.payment_requests r WHERE r.member_id = p.id AND r.status IN ('pending','clarification')) AS pend,
      EXISTS (SELECT 1 FROM public.membership_periods m WHERE m.member_id = p.id AND m.starts_at <= now() AND m.ends_at > now()) AS cur
    FROM public.profiles p
    WHERE NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p.id AND ur.role IN ('admin','super_admin'))
      AND (coalesce(_q,'') = '' OR p.full_name ILIKE '%'||_q||'%' OR p.email ILIKE '%'||_q||'%' OR p.phone ILIKE '%'||_q||'%' OR p.member_code ILIKE '%'||_q||'%')
  ), s AS (
    SELECT b.*, CASE WHEN b.pstate = 'suspended' THEN 'suspended' WHEN b.pstate = 'cancelled' THEN 'cancelled'
      WHEN b.cur THEN 'active' WHEN b.exp IS NULL THEN 'none' WHEN b.exp > now() THEN 'scheduled' ELSE 'expired' END AS st FROM base b
  )
  SELECT s.pid, s.pcode, s.pname, s.pemail, s.pphone, s.pcreated, s.st, s.pln, s.exp, s.pend, count(*) OVER ()
  FROM s WHERE coalesce(_status,'all') = 'all' OR s.st = _status
     OR (_status = 'expiring' AND s.st = 'active' AND s.exp < now() + make_interval(days => soon))
  ORDER BY CASE WHEN _status IN ('expiring','expired') THEN s.exp END ASC NULLS LAST, s.pcreated DESC
  LIMIT least(coalesce(_limit,25),100) OFFSET greatest(coalesce(_offset,0),0);
END $function$;

CREATE TABLE public.check_ins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL,
  staff_id uuid NOT NULL,
  plan_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX check_ins_member_idx ON public.check_ins (member_id, created_at DESC);
CREATE INDEX check_ins_created_idx ON public.check_ins (created_at DESC);
GRANT SELECT ON public.check_ins TO authenticated;
GRANT ALL ON public.check_ins TO service_role;
ALTER TABLE public.check_ins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own or staff read check-ins" ON public.check_ins FOR SELECT TO authenticated
  USING (member_id = auth.uid() OR public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.admit_member(_member uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE r jsonb; ci public.check_ins%ROWTYPE;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  r := public.compute_status(_member);
  IF r->>'status' IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'Entry refused: membership is not active';
  END IF;
  INSERT INTO public.check_ins (member_id, staff_id, plan_name)
  VALUES (_member, auth.uid(), r->>'plan_name') RETURNING * INTO ci;
  PERFORM public.log_audit('member.checked_in', 'check_in', ci.id, _member, '{}'::jsonb);
  RETURN jsonb_build_object('id', ci.id, 'created_at', ci.created_at);
END $function$;