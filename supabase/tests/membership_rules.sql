-- Server-side membership rule tests. Run against the database; always rolls back.
-- Expected final message: ALL_TESTS_PASSED (rolled back)
DO $t$
DECLARE admin uuid := gen_random_uuid(); mem uuid := gen_random_uuid(); other uuid := gen_random_uuid();
  plan uuid; req uuid; r jsonb; e1 timestamptz; e2 timestamptz; n int; ok boolean;
BEGIN
  INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role) VALUES
    (admin, 'zz_admin@test.local', '{"full_name":"Test Admin","phone":"08000000001"}', 'authenticated','authenticated'),
    (mem, 'zz_mem@test.local', '{"full_name":"Test Member","phone":"08000000002"}', 'authenticated','authenticated'),
    (other, 'zz_other@test.local', '{"full_name":"Other Member","phone":"08000000003"}', 'authenticated','authenticated');
  INSERT INTO public.user_roles(user_id, role) VALUES (admin,'admin') ON CONFLICT DO NOTHING;
  DELETE FROM public.user_roles WHERE user_id IN (mem, other) AND role <> 'member';
  SELECT id INTO plan FROM public.membership_plans WHERE name='Weekly';
  -- new account has no membership
  r := public.compute_status(mem);
  IF r->>'status' <> 'none' THEN RAISE EXCEPTION 'FAIL1 %', r; END IF;
  -- member submissions are forced to pending; members cannot approve or extend
  PERFORM set_config('request.jwt.claims', json_build_object('sub', mem, 'role','authenticated')::text, true);
  INSERT INTO public.payment_requests(member_id, plan_id, amount, status) VALUES (mem, plan, 5000, 'approved') RETURNING id INTO req;
  IF (SELECT status FROM public.payment_requests WHERE id=req) <> 'pending' THEN RAISE EXCEPTION 'FAIL2'; END IF;
  ok := false; BEGIN PERFORM public.approve_payment(req, plan); EXCEPTION WHEN others THEN ok := true; END;
  IF NOT ok THEN RAISE EXCEPTION 'FAIL3'; END IF;
  ok := false; BEGIN PERFORM public.admin_grant_period(mem, plan, 'days', 7, 'self'); EXCEPTION WHEN others THEN ok := true; END;
  IF NOT ok THEN RAISE EXCEPTION 'FAIL4'; END IF;
  IF public.compute_status(mem)->>'status' <> 'none' THEN RAISE EXCEPTION 'FAIL5 pending granted access'; END IF;
  -- RLS: no access to other members, no direct writes
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT count(*) INTO n FROM public.profiles WHERE id = other;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL6'; END IF;
  SELECT count(*) INTO n FROM public.payment_requests WHERE member_id = other;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL6c'; END IF;
  BEGIN UPDATE public.profiles SET member_code='HACK' WHERE id=mem; EXCEPTION WHEN others THEN NULL; END;
  BEGIN UPDATE public.payment_requests SET status='approved' WHERE id=req; EXCEPTION WHEN others THEN NULL; END;
  ok := false; BEGIN INSERT INTO public.membership_periods(member_id, plan_name, starts_at, ends_at, source, created_by) VALUES (mem,'x',now(),now()+interval '1 day','manual',mem); EXCEPTION WHEN others THEN ok := true; END;
  IF NOT ok THEN RAISE EXCEPTION 'FAIL8'; END IF;
  EXECUTE 'RESET ROLE';
  IF (SELECT member_code FROM public.profiles WHERE id=mem) = 'HACK' THEN RAISE EXCEPTION 'FAIL7'; END IF;
  IF (SELECT status FROM public.payment_requests WHERE id=req) <> 'pending' THEN RAISE EXCEPTION 'FAIL7b'; END IF;
  -- admin approval extends exactly once
  PERFORM set_config('request.jwt.claims', json_build_object('sub', admin, 'role','authenticated')::text, true);
  r := public.approve_payment(req, plan);
  e1 := (r->>'ends_at')::timestamptz;
  IF abs(extract(epoch from (e1 - now())) - 7*86400) > 5 THEN RAISE EXCEPTION 'FAIL9'; END IF;
  ok := false; BEGIN PERFORM public.approve_payment(req, plan); EXCEPTION WHEN others THEN ok := true; END;
  IF NOT ok THEN RAISE EXCEPTION 'FAIL10 duplicate approval'; END IF;
  SELECT count(*) INTO n FROM public.membership_periods WHERE member_id = mem;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL11'; END IF;
  IF public.verify_member(mem)->>'decision' <> 'granted' THEN RAISE EXCEPTION 'FAIL12'; END IF;
  -- continuous renewal starts from existing expiry
  r := public.admin_grant_period(mem, plan, 'days', 7, 'early renewal');
  IF (r->>'starts_at')::timestamptz <> e1 THEN RAISE EXCEPTION 'FAIL13'; END IF;
  -- suspension denies despite future expiry
  PERFORM public.admin_set_access_state(mem, 'suspended', 'test reason');
  IF public.verify_member(mem)->>'decision' <> 'suspended' THEN RAISE EXCEPTION 'FAIL14'; END IF;
  PERFORM public.admin_set_access_state(mem, 'normal', '');
  -- expired is denied; reactivation starts at approval
  UPDATE public.membership_periods SET starts_at = now() - interval '20 days', ends_at = now() - interval '1 day' WHERE member_id = mem;
  IF public.verify_member(mem)->>'decision' <> 'expired' THEN RAISE EXCEPTION 'FAIL15'; END IF;
  INSERT INTO public.payment_requests(member_id, plan_id, amount) VALUES (mem, plan, 5000) RETURNING id INTO req;
  r := public.approve_payment(req, plan);
  IF abs(extract(epoch from ((r->>'starts_at')::timestamptz - now()))) > 5 THEN RAISE EXCEPTION 'FAIL16'; END IF;
  -- rejection leaves membership unchanged and cannot be approved later
  INSERT INTO public.payment_requests(member_id, plan_id, amount) VALUES (mem, plan, 5000) RETURNING id INTO req;
  SELECT max(ends_at) INTO e2 FROM public.membership_periods WHERE member_id = mem;
  PERFORM public.review_payment(req, 'rejected', 'No matching credit');
  IF (SELECT max(ends_at) FROM public.membership_periods WHERE member_id = mem) <> e2 THEN RAISE EXCEPTION 'FAIL17'; END IF;
  ok := false; BEGIN PERFORM public.approve_payment(req, plan); EXCEPTION WHEN others THEN ok := true; END;
  IF NOT ok THEN RAISE EXCEPTION 'FAIL18'; END IF;
  -- calendar month clamps in gym timezone
  IF public.add_duration('2026-01-31 11:00Z', 'months', 1, 'Africa/Lagos') <> '2026-02-28 11:00Z' THEN RAISE EXCEPTION 'FAIL19'; END IF;
  SELECT count(*) INTO n FROM public.audit_logs WHERE member_id = mem;
  IF n < 6 THEN RAISE EXCEPTION 'FAIL20 audit %', n; END IF;
  RAISE EXCEPTION 'ALL_TESTS_PASSED (rolled back)';
END $t$;
