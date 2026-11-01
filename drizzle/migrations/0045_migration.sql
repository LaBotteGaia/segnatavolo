DO $$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.seat_walkin_freed'::regproc);
  d := replace(d, 'AND t.seats>=_people;', 'AND greatest(coalesce(t.coperti_max,t.seats),t.seats)>=_people;');
  EXECUTE d;
END $$;