CREATE TABLE public.member_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  issued_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  revoked_by uuid,
  revoke_reason text
);
CREATE UNIQUE INDEX member_credentials_one_active ON public.member_credentials(member_id) WHERE status = 'active';
GRANT SELECT ON public.member_credentials TO authenticated;
GRANT ALL ON public.member_credentials TO service_role;
ALTER TABLE public.member_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own credential read" ON public.member_credentials FOR SELECT TO authenticated USING (member_id = auth.uid());

CREATE TABLE public.wallet_passes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  credential_id uuid NOT NULL REFERENCES public.member_credentials(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('apple','google')),
  provider_ref text NOT NULL,
  status text NOT NULL DEFAULT 'issued' CHECK (status IN ('issued','superseded','failed')),
  first_issued_at timestamptz NOT NULL DEFAULT now(),
  last_issued_at timestamptz NOT NULL DEFAULT now(),
  issue_count integer NOT NULL DEFAULT 1,
  last_error text,
  UNIQUE (credential_id, provider)
);
GRANT SELECT ON public.wallet_passes TO authenticated;
GRANT ALL ON public.wallet_passes TO service_role;
ALTER TABLE public.wallet_passes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own wallet passes read" ON public.wallet_passes FOR SELECT TO authenticated USING (member_id = auth.uid() OR public.is_staff(auth.uid()));

ALTER TABLE public.verification_logs ADD COLUMN method text NOT NULL DEFAULT 'search';
CREATE INDEX verification_logs_staff_time ON public.verification_logs(staff_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.new_pass_token() RETURNS text LANGUAGE sql VOLATILE SET search_path TO 'public' AS $$
  SELECT 'OGV1.' || translate(encode(extensions.gen_random_bytes(24),'base64'),'+/=','-_')
$$;

CREATE OR REPLACE FUNCTION public.issue_credential(_member uuid) RETURNS public.member_credentials
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE c public.member_credentials%ROWTYPE;
BEGIN
  SELECT * INTO c FROM public.member_credentials WHERE member_id = _member AND status = 'active';
  IF FOUND THEN RETURN c; END IF;
  INSERT INTO public.member_credentials (member_id, token) VALUES (_member, public.new_pass_token()) RETURNING * INTO c;
  RETURN c;
END $$;
REVOKE ALL ON FUNCTION public.issue_credential(uuid) FROM PUBLIC, anon, authenticated;

INSERT INTO public.member_credentials (member_id, token)
SELECT p.id, public.new_pass_token() FROM public.profiles p
WHERE NOT EXISTS (SELECT 1 FROM public.member_credentials c WHERE c.member_id = p.id AND c.status='active');

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone)
  VALUES (NEW.id, left(coalesce(NEW.raw_user_meta_data->>'full_name',''),120), coalesce(NEW.email,''),
          left(coalesce(NEW.raw_user_meta_data->>'phone',''),30));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'member');
  INSERT INTO public.member_credentials (member_id, token) VALUES (NEW.id, public.new_pass_token());
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.get_my_pass() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE p public.profiles%ROWTYPE; c public.member_credentials%ROWTYPE; st jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT * INTO p FROM public.profiles WHERE id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;
  c := public.issue_credential(p.id);
  st := public.compute_status(p.id);
  RETURN jsonb_build_object(
    'member_code', p.member_code, 'full_name', p.full_name, 'photo_url', p.photo_url,
    'member_since', p.created_at, 'token', c.token, 'credential_id', c.id, 'issued_at', c.issued_at,
    'status', st->>'status', 'plan_name', st->>'plan_name', 'pending_requests', (st->>'pending_requests')::int,
    'wallet', coalesce((SELECT jsonb_agg(jsonb_build_object('provider', w.provider, 'status', w.status, 'last_issued_at', w.last_issued_at))
       FROM public.wallet_passes w WHERE w.credential_id = c.id AND w.status = 'issued'), '[]'::jsonb));
END $$;

CREATE OR REPLACE FUNCTION public.rotate_credential(_member uuid, _reason text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE old uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF _member <> auth.uid() AND NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Not authorised'; END IF;
  IF length(trim(coalesce(_reason,''))) < 3 THEN RAISE EXCEPTION 'Please give a reason'; END IF;
  PERFORM 1 FROM public.profiles WHERE id = _member FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Member not found'; END IF;
  UPDATE public.member_credentials SET status='revoked', revoked_at=now(), revoked_by=auth.uid(), revoke_reason=left(_reason,300)
   WHERE member_id=_member AND status='active' RETURNING id INTO old;
  UPDATE public.wallet_passes SET status='superseded' WHERE credential_id = old;
  INSERT INTO public.member_credentials (member_id, token) VALUES (_member, public.new_pass_token());
  PERFORM public.log_audit('pass.replaced','member_credential', old, _member, jsonb_build_object('reason', _reason));
  PERFORM public.notify(_member, 'pass_replaced', 'Access pass replaced',
    'Your previous pass no longer works. Add the new pass to your Wallet from My Access Pass.', coalesce(old::text,'') || ':rot');
END $$;

CREATE OR REPLACE FUNCTION public.verify_pass(_token text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE c public.member_credentials%ROWTYPE; r jsonb; decision text; bad int; lp jsonb;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  SELECT count(*) INTO bad FROM public.verification_logs
   WHERE staff_id = auth.uid() AND method = 'pass' AND result IN ('invalid_pass','revoked_pass') AND created_at > now() - interval '10 minutes';
  IF bad >= 20 THEN RAISE EXCEPTION 'Too many invalid passes scanned. Wait a few minutes, or search by member ID.'; END IF;
  IF (SELECT count(*) FROM public.verification_logs WHERE staff_id = auth.uid() AND created_at > now() - interval '1 minute') >= 60 THEN
    RAISE EXCEPTION 'Too many checks in a short time. Please wait a moment.';
  END IF;
  SELECT * INTO c FROM public.member_credentials WHERE token = left(coalesce(_token,''), 100);
  IF NOT FOUND OR c.status <> 'active' THEN
    INSERT INTO public.verification_logs (member_id, result, staff_id, method)
    VALUES (CASE WHEN FOUND THEN c.member_id END, CASE WHEN FOUND THEN 'revoked_pass' ELSE 'invalid_pass' END, auth.uid(), 'pass');
    RETURN jsonb_build_object('status','not_found','decision', CASE WHEN c.id IS NOT NULL THEN 'revoked_pass' ELSE 'invalid_pass' END, 'checked_at', now());
  END IF;
  r := public.compute_status(c.member_id);
  decision := CASE r->>'status' WHEN 'active' THEN 'granted' WHEN 'expired' THEN 'expired'
    WHEN 'suspended' THEN 'suspended' WHEN 'cancelled' THEN 'cancelled' WHEN 'not_found' THEN 'not_found' ELSE 'no_membership' END;
  SELECT jsonb_build_object('amount', pr.amount, 'plan', pl.name, 'approved_at', pr.reviewed_at) INTO lp
    FROM public.payment_requests pr LEFT JOIN public.membership_plans pl ON pl.id = pr.plan_id
    WHERE pr.member_id = c.member_id AND pr.status = 'approved' ORDER BY pr.reviewed_at DESC LIMIT 1;
  INSERT INTO public.verification_logs (member_id, result, staff_id, method) VALUES (c.member_id, decision, auth.uid(), 'pass');
  RETURN r || jsonb_build_object('decision', decision, 'last_payment', lp,
    'last_verified', (SELECT created_at FROM public.verification_logs WHERE member_id = c.member_id ORDER BY created_at DESC OFFSET 1 LIMIT 1));
END $$;

CREATE OR REPLACE FUNCTION public.verify_member(_member uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE r jsonb; decision text; lp jsonb;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  r := public.compute_status(_member);
  decision := CASE r->>'status' WHEN 'active' THEN 'granted' WHEN 'expired' THEN 'expired'
    WHEN 'suspended' THEN 'suspended' WHEN 'cancelled' THEN 'cancelled' WHEN 'not_found' THEN 'not_found' ELSE 'no_membership' END;
  SELECT jsonb_build_object('amount', pr.amount, 'plan', pl.name, 'approved_at', pr.reviewed_at) INTO lp
    FROM public.payment_requests pr LEFT JOIN public.membership_plans pl ON pl.id = pr.plan_id
    WHERE pr.member_id = _member AND pr.status = 'approved' ORDER BY pr.reviewed_at DESC LIMIT 1;
  INSERT INTO public.verification_logs (member_id, result, staff_id)
  VALUES (CASE WHEN decision = 'not_found' THEN NULL ELSE _member END, decision, auth.uid());
  RETURN r || jsonb_build_object('decision', decision, 'last_payment', lp,
    'last_verified', (SELECT created_at FROM public.verification_logs WHERE member_id = _member ORDER BY created_at DESC OFFSET 1 LIMIT 1));
END $function$;

-- Server-side wallet issuance helper (service role only)
CREATE OR REPLACE FUNCTION public.record_wallet_issue(_credential uuid, _provider text, _ref text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  INSERT INTO public.wallet_passes (member_id, credential_id, provider, provider_ref)
  SELECT member_id, id, _provider, _ref FROM public.member_credentials WHERE id = _credential AND status = 'active'
  ON CONFLICT (credential_id, provider) DO UPDATE SET last_issued_at = now(), issue_count = public.wallet_passes.issue_count + 1,
    status = 'issued', last_error = NULL, provider_ref = EXCLUDED.provider_ref;
$$;
REVOKE ALL ON FUNCTION public.record_wallet_issue(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_wallet_issue(uuid, text, text) TO service_role;