
CREATE OR REPLACE FUNCTION public.staff_member_status(_member uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN RAISE EXCEPTION 'Not authorised'; END IF;
  RETURN public.compute_status(_member);
END $$;
