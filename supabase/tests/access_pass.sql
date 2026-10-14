-- Access pass rules. Runs inside a transaction and rolls back.
BEGIN;
DO $$
DECLARE staff uuid; m uuid; tok text; r jsonb; n int;
BEGIN
  SELECT user_id INTO staff FROM public.user_roles WHERE role='admin' LIMIT 1;
  SELECT p.id INTO m FROM public.profiles p WHERE NOT EXISTS (SELECT 1 FROM public.user_roles u WHERE u.user_id=p.id AND u.role<>'member') LIMIT 1;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', m, 'role','authenticated')::text, true);
  r := public.get_my_pass(); tok := r->>'token';
  ASSERT tok LIKE 'OGV1.%' AND length(tok) > 30, 'opaque token';
  ASSERT public.get_my_pass()->>'token' = tok, 'stable across requests';
  SELECT count(*) INTO n FROM public.member_credentials WHERE member_id=m AND status='active';
  ASSERT n = 1, 'one active credential';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', staff, 'role','authenticated')::text, true);
  r := public.verify_pass(tok);
  ASSERT r->>'member_id' = m::text, 'resolves to member';
  ASSERT r->>'decision' = CASE (public.staff_member_status(m)->>'status') WHEN 'active' THEN 'granted' WHEN 'expired' THEN 'expired' WHEN 'suspended' THEN 'suspended' WHEN 'cancelled' THEN 'cancelled' ELSE 'no_membership' END, 'live status decides';
  ASSERT public.verify_pass('OGV1.nope')->>'decision' = 'invalid_pass', 'unknown denied';
  -- expired member keeps pass but is denied
  PERFORM public.admin_set_access_state(m, 'suspended', 'test');
  ASSERT public.verify_pass(tok)->>'decision' = 'suspended', 'suspended denied';
  PERFORM public.admin_set_access_state(m, 'normal', 'test');
  PERFORM public.rotate_credential(m, 'lost phone');
  ASSERT public.verify_pass(tok)->>'decision' = 'revoked_pass', 'revoked denied';
  ASSERT (SELECT count(*) FROM public.verification_logs WHERE staff_id=staff AND method='pass' AND created_at > now() - interval '1 minute') >= 4, 'logged';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', m, 'role','authenticated')::text, true);
  ASSERT public.get_my_pass()->>'token' <> tok, 'replacement issued';
  BEGIN PERFORM public.verify_pass(tok); RAISE EXCEPTION 'member could verify'; EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'member could verify' THEN RAISE; END IF; END;
  RAISE NOTICE 'access pass tests passed';
END $$;
ROLLBACK;
