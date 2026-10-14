
CREATE TYPE public.app_role AS ENUM ('admin','reception','member');
CREATE TYPE public.duration_unit AS ENUM ('days','months');
CREATE TYPE public.access_state AS ENUM ('normal','suspended','cancelled');
CREATE TYPE public.payment_status AS ENUM ('pending','approved','rejected','clarification');

CREATE SEQUENCE public.member_code_seq START 1;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  member_code text NOT NULL UNIQUE DEFAULT ('OGV-' || lpad(nextval('public.member_code_seq')::text, 5, '0')),
  full_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  photo_url text,
  access_state public.access_state NOT NULL DEFAULT 'normal',
  access_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX profiles_email_idx ON public.profiles (lower(email));
CREATE INDEX profiles_phone_idx ON public.profiles (phone);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);

CREATE TABLE public.membership_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  price numeric(12,2) NOT NULL CHECK (price >= 0),
  duration_unit public.duration_unit NOT NULL,
  duration_value int NOT NULL CHECK (duration_value > 0 AND duration_value <= 3660),
  description text NOT NULL DEFAULT '',
  terms text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.payment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL,
  plan_id uuid NOT NULL REFERENCES public.membership_plans(id),
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  reference text NOT NULL DEFAULT '',
  paid_on date,
  receipt_path text,
  note text NOT NULL DEFAULT '',
  status public.payment_status NOT NULL DEFAULT 'pending',
  review_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payment_requests_member_idx ON public.payment_requests (member_id, created_at DESC);
CREATE INDEX payment_requests_status_idx ON public.payment_requests (status, created_at);

CREATE TABLE public.membership_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL,
  plan_id uuid REFERENCES public.membership_plans(id),
  plan_name text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  source text NOT NULL CHECK (source IN ('payment','manual')),
  payment_request_id uuid UNIQUE REFERENCES public.payment_requests(id),
  previous_expiry timestamptz,
  reason text NOT NULL DEFAULT '',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);
CREATE INDEX membership_periods_member_idx ON public.membership_periods (member_id, ends_at DESC);

CREATE TABLE public.verification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid,
  result text NOT NULL,
  staff_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX verification_logs_created_idx ON public.verification_logs (created_at DESC);

CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id uuid,
  member_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_created_idx ON public.audit_logs (created_at DESC);

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  ref text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX notifications_dedupe ON public.notifications (user_id, kind, ref) WHERE ref IS NOT NULL;
CREATE INDEX notifications_user_idx ON public.notifications (user_id, created_at DESC);

CREATE TABLE public.gym_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  gym_name text NOT NULL DEFAULT 'OGV Gym',
  timezone text NOT NULL DEFAULT 'Africa/Lagos',
  renewal_rule text NOT NULL DEFAULT 'from_expiry' CHECK (renewal_rule IN ('from_expiry','from_approval')),
  expiring_soon_days int NOT NULL DEFAULT 5 CHECK (expiring_soon_days BETWEEN 1 AND 60),
  payment_instructions text NOT NULL DEFAULT '',
  support_contact text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.gym_settings (id, payment_instructions, support_contact) VALUES (1,
 'Pay by bank transfer to the account shown at reception, then upload your transfer receipt here. Use your member ID as the transfer narration.',
 'Speak to the front desk or call the gym line.');

INSERT INTO public.membership_plans (name, price, duration_unit, duration_value, description, sort_order) VALUES
 ('Weekly', 5000, 'days', 7, 'Seven days of full gym access.', 1),
 ('Monthly', 15000, 'months', 1, 'One calendar month of full gym access.', 2),
 ('Quarterly', 40000, 'months', 3, 'Three calendar months of full gym access.', 3);

-- Grants
GRANT SELECT ON public.profiles TO authenticated;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.membership_plans TO authenticated;
GRANT SELECT, INSERT ON public.payment_requests TO authenticated;
GRANT SELECT ON public.membership_periods TO authenticated;
GRANT SELECT ON public.verification_logs TO authenticated;
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT SELECT ON public.notifications TO authenticated;
GRANT UPDATE (read_at) ON public.notifications TO authenticated;
GRANT SELECT, UPDATE ON public.gym_settings TO authenticated;
GRANT ALL ON public.profiles, public.user_roles, public.membership_plans, public.payment_requests,
  public.membership_periods, public.verification_logs, public.audit_logs, public.notifications, public.gym_settings TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membership_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membership_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gym_settings ENABLE ROW LEVEL SECURITY;

-- Role helpers
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','reception'))
$$;

-- Policies
CREATE POLICY "own or staff read profile" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "own roles or admin" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "read plans" ON public.membership_plans FOR SELECT TO authenticated
  USING (is_active OR public.is_staff(auth.uid()));
CREATE POLICY "admin insert plans" ON public.membership_plans FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin update plans" ON public.membership_plans FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "own or staff read payments" ON public.payment_requests FOR SELECT TO authenticated
  USING (member_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "member submits own payment" ON public.payment_requests FOR INSERT TO authenticated
  WITH CHECK (member_id = auth.uid());
CREATE POLICY "own or staff read periods" ON public.membership_periods FOR SELECT TO authenticated
  USING (member_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "staff read verifications" ON public.verification_logs FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "admin read audit" ON public.audit_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "own notifications" ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "own notifications update" ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "read settings" ON public.gym_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin update settings" ON public.gym_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Helpers
CREATE OR REPLACE FUNCTION public.add_duration(_start timestamptz, _unit public.duration_unit, _value int, _tz text)
RETURNS timestamptz LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN _unit = 'days' THEN _start + make_interval(days => _value)
              ELSE ((_start AT TIME ZONE _tz) + make_interval(months => _value)) AT TIME ZONE _tz END
$$;

CREATE OR REPLACE FUNCTION public.log_audit(_action text, _entity text, _entity_id uuid, _member uuid, _details jsonb)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.audit_logs (actor_id, action, entity, entity_id, member_id, details)
  VALUES (auth.uid(), _action, _entity, _entity_id, _member, coalesce(_details,'{}'::jsonb));
$$;

CREATE OR REPLACE FUNCTION public.notify(_user uuid, _kind text, _title text, _body text, _ref text DEFAULT NULL)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.notifications (user_id, kind, title, body, ref) VALUES (_user, _kind, _title, _body, _ref)
  ON CONFLICT DO NOTHING;
$$;

-- Authoritative status: the single source of truth for access.
CREATE OR REPLACE FUNCTION public.compute_status(_member uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  p public.profiles%ROWTYPE;
  cur public.membership_periods%ROWTYPE;
  latest public.membership_periods%ROWTYPE;
  st text;
  pend int;
BEGIN
  SELECT * INTO p FROM public.profiles WHERE id = _member;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','not_found'); END IF;
  SELECT * INTO cur FROM public.membership_periods
    WHERE member_id = _member AND starts_at <= now() AND ends_at > now()
    ORDER BY ends_at DESC LIMIT 1;
  SELECT * INTO latest FROM public.membership_periods WHERE member_id = _member ORDER BY ends_at DESC LIMIT 1;
  SELECT count(*) INTO pend FROM public.payment_requests WHERE member_id = _member AND status IN ('pending','clarification');
  IF p.access_state = 'suspended' THEN st := 'suspended';
  ELSIF p.access_state = 'cancelled' THEN st := 'cancelled';
  ELSIF cur.id IS NOT NULL THEN st := 'active';
  ELSIF latest.id IS NOT NULL AND latest.starts_at > now() THEN st := 'scheduled';
  ELSIF latest.id IS NOT NULL THEN st := 'expired';
  ELSE st := 'none';
  END IF;
  RETURN jsonb_build_object(
    'status', st,
    'member_id', p.id, 'member_code', p.member_code, 'full_name', p.full_name,
    'email', p.email, 'phone', p.phone, 'photo_url', p.photo_url,
    'access_reason', p.access_reason,
    'plan_name', coalesce(cur.plan_name, latest.plan_name),
    'starts_at', coalesce(cur.starts_at, latest.starts_at),
    'expires_at', latest.ends_at,
    'pending_requests', pend,
    'checked_at', now());
END $$;

CREATE OR REPLACE FUNCTION public.get_my_status()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.compute_status(auth.uid());
$$;

-- Signup trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone)
  VALUES (NEW.id, left(coalesce(NEW.raw_user_meta_data->>'full_name',''),120), coalesce(NEW.email,''),
          left(coalesce(NEW.raw_user_meta_data->>'phone',''),30));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'member');
  -- Bootstrap: the very first account becomes the administrator.
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Payment submissions are always forced to pending
CREATE OR REPLACE FUNCTION public.payment_request_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pl public.membership_plans%ROWTYPE; a record;
BEGIN
  SELECT * INTO pl FROM public.membership_plans WHERE id = NEW.plan_id;
  IF NOT FOUND OR NOT pl.is_active THEN RAISE EXCEPTION 'This plan is not available'; END IF;
  IF (SELECT count(*) FROM public.payment_requests WHERE member_id = NEW.member_id AND status IN ('pending','clarification')) >= 3 THEN
    RAISE EXCEPTION 'You already have requests awaiting review';
  END IF;
  NEW.status := 'pending'; NEW.review_note := NULL; NEW.reviewed_by := NULL; NEW.reviewed_at := NULL;
  NEW.created_at := now();
  NEW.reference := left(NEW.reference, 120); NEW.note := left(NEW.note, 1000);
  IF NEW.receipt_path IS NOT NULL AND split_part(NEW.receipt_path,'/',1) <> NEW.member_id::text THEN
    RAISE EXCEPTION 'Invalid receipt';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER payment_request_guard BEFORE INSERT ON public.payment_requests
  FOR EACH ROW EXECUTE FUNCTION public.payment_request_guard();

CREATE OR REPLACE FUNCTION public.payment_request_after()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; nm text;
BEGIN
  SELECT full_name INTO nm FROM public.profiles WHERE id = NEW.member_id;
  INSERT INTO public.audit_logs (actor_id, action, entity, entity_id, member_id, details)
  VALUES (NEW.member_id, 'payment.submitted', 'payment_request', NEW.id, NEW.member_id, jsonb_build_object('amount', NEW.amount));
  FOR r IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
    PERFORM public.notify(r.user_id, 'renewal_submitted', 'New renewal request', coalesce(nm,'A member') || ' submitted payment evidence for review.', NEW.id::text);
  END LOOP;
  PERFORM public.notify(NEW.member_id, 'renewal_received', 'Renewal request received', 'Your payment evidence is awaiting verification. Your membership has not changed yet.', NEW.id::text);
  RETURN NEW;
END $$;
CREATE TRIGGER payment_request_after AFTER INSERT ON public.payment_requests
  FOR EACH ROW EXECUTE FUNCTION public.payment_request_after();

-- Compute start date for a new period
CREATE OR REPLACE FUNCTION public.next_period_start(_member uuid, _rule text)
RETURNS timestamptz LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN _rule = 'from_expiry' AND max(ends_at) > now() THEN max(ends_at) ELSE now() END
  FROM public.membership_periods WHERE member_id = _member;
$$;

CREATE OR REPLACE FUNCTION public.preview_period(_member uuid, _unit public.duration_unit, _value int)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.gym_settings%ROWTYPE; st timestamptz;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Not authorised'; END IF;
  SELECT * INTO s FROM public.gym_settings WHERE id = 1;
  st := public.next_period_start(_member, s.renewal_rule);
  RETURN jsonb_build_object('starts_at', st, 'ends_at', public.add_duration(st, _unit, _value, s.timezone),
    'current_expiry', (SELECT max(ends_at) FROM public.membership_periods WHERE member_id = _member));
END $$;

CREATE OR REPLACE FUNCTION public.approve_payment(_request uuid, _plan uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE req public.payment_requests%ROWTYPE; pl public.membership_plans%ROWTYPE; s public.gym_settings%ROWTYPE;
  st timestamptz; en timestamptz; prev timestamptz; pid uuid;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Not authorised'; END IF;
  SELECT * INTO req FROM public.payment_requests WHERE id = _request FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF req.status NOT IN ('pending','clarification') THEN RAISE EXCEPTION 'This request has already been %', req.status; END IF;
  SELECT * INTO pl FROM public.membership_plans WHERE id = coalesce(_plan, req.plan_id);
  IF NOT FOUND THEN RAISE EXCEPTION 'Plan not found'; END IF;
  SELECT * INTO s FROM public.gym_settings WHERE id = 1;
  PERFORM 1 FROM public.profiles WHERE id = req.member_id FOR UPDATE;
  SELECT max(ends_at) INTO prev FROM public.membership_periods WHERE member_id = req.member_id;
  st := public.next_period_start(req.member_id, s.renewal_rule);
  en := public.add_duration(st, pl.duration_unit, pl.duration_value, s.timezone);
  INSERT INTO public.membership_periods (member_id, plan_id, plan_name, starts_at, ends_at, source, payment_request_id, previous_expiry, created_by, reason)
  VALUES (req.member_id, pl.id, pl.name, st, en, 'payment', req.id, prev, auth.uid(), 'Payment approved')
  RETURNING id INTO pid;
  UPDATE public.payment_requests SET status = 'approved', plan_id = pl.id, reviewed_by = auth.uid(), reviewed_at = now(), review_note = NULL WHERE id = req.id;
  PERFORM public.log_audit('payment.approved','payment_request', req.id, req.member_id,
    jsonb_build_object('plan', pl.name, 'previous_expiry', prev, 'starts_at', st, 'ends_at', en, 'amount', req.amount));
  PERFORM public.notify(req.member_id, 'payment_approved', 'Payment approved',
    'Your ' || pl.name || ' membership is valid until ' || to_char(en AT TIME ZONE s.timezone, 'DD Mon YYYY, HH24:MI') || '.', req.id::text);
  RETURN jsonb_build_object('period_id', pid, 'starts_at', st, 'ends_at', en);
END $$;

CREATE OR REPLACE FUNCTION public.review_payment(_request uuid, _decision text, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE req public.payment_requests%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Not authorised'; END IF;
  IF _decision NOT IN ('rejected','clarification') THEN RAISE EXCEPTION 'Invalid decision'; END IF;
  IF length(trim(coalesce(_note,''))) < 3 THEN RAISE EXCEPTION 'Please give a reason'; END IF;
  SELECT * INTO req FROM public.payment_requests WHERE id = _request FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF req.status NOT IN ('pending','clarification') THEN RAISE EXCEPTION 'This request has already been %', req.status; END IF;
  UPDATE public.payment_requests SET status = _decision::public.payment_status, review_note = left(_note, 500),
    reviewed_by = auth.uid(), reviewed_at = now() WHERE id = req.id;
  PERFORM public.log_audit('payment.' || _decision, 'payment_request', req.id, req.member_id, jsonb_build_object('note', _note));
  IF _decision = 'rejected' THEN
    PERFORM public.notify(req.member_id, 'payment_rejected', 'Payment not approved', _note, req.id::text || ':rej');
  ELSE
    PERFORM public.notify(req.member_id, 'payment_clarification', 'More information needed', _note, req.id::text || ':clar:' || extract(epoch from now())::text);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.respond_clarification(_request uuid, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE req public.payment_requests%ROWTYPE;
BEGIN
  SELECT * INTO req FROM public.payment_requests WHERE id = _request FOR UPDATE;
  IF NOT FOUND OR req.member_id <> auth.uid() THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF req.status <> 'clarification' THEN RAISE EXCEPTION 'No clarification was requested'; END IF;
  UPDATE public.payment_requests SET status = 'pending',
    note = left(req.note || E'\n\nReply: ' || coalesce(_note,''), 2000) WHERE id = req.id;
  PERFORM public.log_audit('payment.clarified','payment_request', req.id, req.member_id, '{}'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.admin_grant_period(_member uuid, _plan uuid, _unit public.duration_unit, _value int, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.gym_settings%ROWTYPE; pl public.membership_plans%ROWTYPE; st timestamptz; en timestamptz; prev timestamptz; nm text;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Not authorised'; END IF;
  IF length(trim(coalesce(_reason,''))) < 3 THEN RAISE EXCEPTION 'Please give a reason'; END IF;
  PERFORM 1 FROM public.profiles WHERE id = _member FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Member not found'; END IF;
  SELECT * INTO s FROM public.gym_settings WHERE id = 1;
  IF _plan IS NOT NULL THEN
    SELECT * INTO pl FROM public.membership_plans WHERE id = _plan;
    _unit := pl.duration_unit; _value := pl.duration_value; nm := pl.name;
  ELSE nm := 'Custom (' || _value || ' ' || _unit || ')'; END IF;
  IF _value IS NULL OR _value <= 0 OR _value > 3660 THEN RAISE EXCEPTION 'Invalid duration'; END IF;
  SELECT max(ends_at) INTO prev FROM public.membership_periods WHERE member_id = _member;
  st := public.next_period_start(_member, s.renewal_rule);
  en := public.add_duration(st, _unit, _value, s.timezone);
  INSERT INTO public.membership_periods (member_id, plan_id, plan_name, starts_at, ends_at, source, previous_expiry, created_by, reason)
  VALUES (_member, _plan, nm, st, en, 'manual', prev, auth.uid(), left(_reason,500));
  PERFORM public.log_audit(CASE WHEN prev IS NULL THEN 'membership.activated' WHEN prev > now() THEN 'membership.extended' ELSE 'membership.reactivated' END,
    'membership', _member, _member, jsonb_build_object('plan', nm, 'previous_expiry', prev, 'starts_at', st, 'ends_at', en, 'reason', _reason));
  PERFORM public.notify(_member, 'membership_activated', 'Membership updated',
    'Your ' || nm || ' membership is valid until ' || to_char(en AT TIME ZONE s.timezone, 'DD Mon YYYY, HH24:MI') || '.', NULL);
  RETURN jsonb_build_object('starts_at', st, 'ends_at', en);
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_access_state(_member uuid, _state public.access_state, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE old public.access_state;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Not authorised'; END IF;
  IF _state <> 'normal' AND length(trim(coalesce(_reason,''))) < 3 THEN RAISE EXCEPTION 'Please give a reason'; END IF;
  SELECT access_state INTO old FROM public.profiles WHERE id = _member FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Member not found'; END IF;
  UPDATE public.profiles SET access_state = _state, access_reason = CASE WHEN _state = 'normal' THEN NULL ELSE left(_reason,500) END WHERE id = _member;
  PERFORM public.log_audit('membership.' || CASE _state WHEN 'normal' THEN 'restored' ELSE _state::text END, 'membership', _member, _member,
    jsonb_build_object('from', old, 'to', _state, 'reason', _reason));
  PERFORM public.notify(_member, 'membership_' || _state::text,
    CASE _state WHEN 'suspended' THEN 'Membership suspended' WHEN 'cancelled' THEN 'Membership cancelled' ELSE 'Membership access restored' END,
    coalesce(_reason,''), NULL);
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_role(_user uuid, _role public.app_role, _grant boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Not authorised'; END IF;
  IF _role = 'member' THEN RAISE EXCEPTION 'Invalid role'; END IF;
  IF NOT _grant AND _user = auth.uid() AND _role = 'admin' THEN RAISE EXCEPTION 'You cannot remove your own admin role'; END IF;
  IF _grant THEN INSERT INTO public.user_roles (user_id, role) VALUES (_user, _role) ON CONFLICT DO NOTHING;
  ELSE DELETE FROM public.user_roles WHERE user_id = _user AND role = _role; END IF;
  PERFORM public.log_audit(CASE WHEN _grant THEN 'role.granted' ELSE 'role.revoked' END, 'user_role', _user, _user, jsonb_build_object('role', _role));
END $$;

CREATE OR REPLACE FUNCTION public.update_my_profile(_full_name text, _phone text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE old public.profiles%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF length(trim(coalesce(_full_name,''))) < 2 OR length(_full_name) > 120 THEN RAISE EXCEPTION 'Enter your full name'; END IF;
  IF _phone !~ '^\+?[0-9 ()-]{7,20}$' THEN RAISE EXCEPTION 'Enter a valid phone number'; END IF;
  SELECT * INTO old FROM public.profiles WHERE id = auth.uid();
  UPDATE public.profiles SET full_name = trim(_full_name), phone = trim(_phone) WHERE id = auth.uid();
  PERFORM public.log_audit('profile.updated','profile', auth.uid(), auth.uid(),
    jsonb_build_object('old_phone', old.phone, 'new_phone', _phone, 'old_name', old.full_name, 'new_name', _full_name));
END $$;

-- Verification
CREATE OR REPLACE FUNCTION public.search_members(_q text, _limit int DEFAULT 8)
RETURNS TABLE (id uuid, member_code text, full_name text, email text, phone text, photo_url text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE q text := trim(coalesce(_q,'')); digits text := regexp_replace(coalesce(_q,''), '[^0-9]', '', 'g');
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  IF length(q) < 2 THEN RETURN; END IF;
  RETURN QUERY
    SELECT p.id, p.member_code, p.full_name, p.email, p.phone, p.photo_url FROM public.profiles p
    WHERE upper(p.member_code) = upper(q)
       OR (q ~ '^[0-9]+$' AND p.member_code = 'OGV-' || lpad(q, 5, '0'))
       OR lower(p.email) = lower(q)
       OR (length(digits) >= 7 AND regexp_replace(p.phone, '[^0-9]', '', 'g') LIKE '%' || right(digits, 10))
       OR p.full_name ILIKE '%' || q || '%'
       OR p.email ILIKE q || '%'
    ORDER BY (upper(p.member_code) = upper(q)) DESC, p.full_name
    LIMIT least(coalesce(_limit, 8), 50);
END $$;

CREATE OR REPLACE FUNCTION public.verify_member(_member uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r jsonb; decision text;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  r := public.compute_status(_member);
  decision := CASE r->>'status' WHEN 'active' THEN 'granted' WHEN 'expired' THEN 'expired'
    WHEN 'suspended' THEN 'suspended' WHEN 'cancelled' THEN 'cancelled' WHEN 'not_found' THEN 'not_found' ELSE 'no_membership' END;
  INSERT INTO public.verification_logs (member_id, result, staff_id)
  VALUES (CASE WHEN decision = 'not_found' THEN NULL ELSE _member END, decision, auth.uid());
  RETURN r || jsonb_build_object('decision', decision,
    'last_verified', (SELECT created_at FROM public.verification_logs WHERE member_id = _member ORDER BY created_at DESC OFFSET 1 LIMIT 1));
END $$;

-- Member directory with derived status
CREATE OR REPLACE FUNCTION public.admin_list_members(_q text, _status text, _limit int, _offset int)
RETURNS TABLE (id uuid, member_code text, full_name text, email text, phone text, created_at timestamptz,
  status text, plan_name text, expires_at timestamptz, pending_requests int, total_count bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  RETURN QUERY
  WITH base AS (
    SELECT p.*, (SELECT max(m.ends_at) FROM public.membership_periods m WHERE m.member_id = p.id) AS exp,
      (SELECT m.plan_name FROM public.membership_periods m WHERE m.member_id = p.id ORDER BY m.ends_at DESC LIMIT 1) AS pln,
      (SELECT count(*)::int FROM public.payment_requests r WHERE r.member_id = p.id AND r.status IN ('pending','clarification')) AS pend,
      EXISTS (SELECT 1 FROM public.membership_periods m WHERE m.member_id = p.id AND m.starts_at <= now() AND m.ends_at > now()) AS cur
    FROM public.profiles p
    WHERE coalesce(_q,'') = '' OR p.full_name ILIKE '%'||_q||'%' OR p.email ILIKE '%'||_q||'%' OR p.phone ILIKE '%'||_q||'%' OR p.member_code ILIKE '%'||_q||'%'
  ), s AS (
    SELECT b.*, CASE WHEN b.access_state = 'suspended' THEN 'suspended' WHEN b.access_state = 'cancelled' THEN 'cancelled'
      WHEN b.cur THEN 'active' WHEN b.exp IS NULL THEN 'none' WHEN b.exp > now() THEN 'scheduled' ELSE 'expired' END AS st FROM base b
  )
  SELECT s.id, s.member_code, s.full_name, s.email, s.phone, s.created_at, s.st, s.pln, s.exp, s.pend, count(*) OVER ()
  FROM s WHERE coalesce(_status,'all') = 'all' OR s.st = _status
     OR (_status = 'expiring' AND s.st = 'active' AND s.exp < now() + make_interval(days => (SELECT expiring_soon_days FROM public.gym_settings WHERE id=1)))
  ORDER BY CASE WHEN _status IN ('expiring','expired') THEN s.exp END ASC NULLS LAST, s.created_at DESC
  LIMIT least(coalesce(_limit,25),100) OFFSET greatest(coalesce(_offset,0),0);
END $$;

CREATE OR REPLACE FUNCTION public.admin_overview()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE soon int;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  SELECT expiring_soon_days INTO soon FROM public.gym_settings WHERE id = 1;
  RETURN (
    WITH s AS (
      SELECT p.id, p.access_state,
        EXISTS (SELECT 1 FROM public.membership_periods m WHERE m.member_id = p.id AND m.starts_at <= now() AND m.ends_at > now()) AS cur,
        (SELECT max(ends_at) FROM public.membership_periods m WHERE m.member_id = p.id) AS exp
      FROM public.profiles p)
    SELECT jsonb_build_object(
      'total', count(*),
      'active', count(*) FILTER (WHERE access_state = 'normal' AND cur),
      'expired', count(*) FILTER (WHERE access_state = 'normal' AND NOT cur AND exp IS NOT NULL AND exp <= now()),
      'none', count(*) FILTER (WHERE access_state = 'normal' AND exp IS NULL),
      'suspended', count(*) FILTER (WHERE access_state = 'suspended'),
      'expiring_soon', count(*) FILTER (WHERE access_state = 'normal' AND cur AND exp < now() + make_interval(days => soon)),
      'pending_payments', (SELECT count(*) FROM public.payment_requests WHERE status IN ('pending','clarification')),
      'verifications_today', (SELECT count(*) FROM public.verification_logs WHERE created_at > date_trunc('day', now())),
      'expiring_soon_days', soon)
    FROM s);
END $$;

CREATE OR REPLACE FUNCTION public.admin_reports(_days int)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE since timestamptz := now() - make_interval(days => least(greatest(coalesce(_days,30),1),366));
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Not authorised'; END IF;
  RETURN jsonb_build_object(
    'revenue', (SELECT coalesce(sum(amount),0) FROM public.payment_requests WHERE status='approved' AND reviewed_at >= since),
    'approved', (SELECT count(*) FROM public.payment_requests WHERE status='approved' AND reviewed_at >= since),
    'rejected', (SELECT count(*) FROM public.payment_requests WHERE status='rejected' AND reviewed_at >= since),
    'new_members', (SELECT count(*) FROM public.profiles WHERE created_at >= since),
    'by_plan', (SELECT coalesce(jsonb_agg(x ORDER BY x.revenue DESC),'[]'::jsonb) FROM (
        SELECT pl.name, count(*) AS count, sum(r.amount) AS revenue FROM public.payment_requests r JOIN public.membership_plans pl ON pl.id = r.plan_id
        WHERE r.status='approved' AND r.reviewed_at >= since GROUP BY pl.name) x),
    'verifications', (SELECT coalesce(jsonb_object_agg(result, c),'{}'::jsonb) FROM (
        SELECT result, count(*) c FROM public.verification_logs WHERE created_at >= since GROUP BY result) v));
END $$;

-- Expiry notices generated idempotently whenever a member opens the portal
CREATE OR REPLACE FUNCTION public.sync_my_notices()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE latest public.membership_periods%ROWTYPE; s public.gym_settings%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  SELECT * INTO s FROM public.gym_settings WHERE id = 1;
  SELECT * INTO latest FROM public.membership_periods WHERE member_id = auth.uid() ORDER BY ends_at DESC LIMIT 1;
  IF latest.id IS NULL THEN RETURN; END IF;
  IF latest.ends_at <= now() THEN
    PERFORM public.notify(auth.uid(), 'membership_expired', 'Membership expired', 'Your membership has ended. Submit a renewal to regain access.', latest.id::text);
  ELSIF latest.ends_at < now() + make_interval(days => s.expiring_soon_days) THEN
    PERFORM public.notify(auth.uid(), 'membership_expiring', 'Membership expiring soon',
      'Your membership ends on ' || to_char(latest.ends_at AT TIME ZONE s.timezone, 'DD Mon YYYY') || '.', latest.id::text);
  END IF;
END $$;

REVOKE EXECUTE ON FUNCTION public.log_audit(text,text,uuid,uuid,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify(uuid,text,text,text,text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.compute_status(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.next_period_start(uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
