CREATE OR REPLACE FUNCTION public.decide_online_booking(_restaurant_id uuid, _id uuid, _accept boolean, _tables uuid[] DEFAULT '{}'::uuid[], _extras jsonb DEFAULT '{}'::jsonb, _reason text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r public.reservations; st jsonb; d int; b int; conflict boolean; cap int;
BEGIN
 IF _accept IS NULL OR _restaurant_id IS NULL OR _id IS NULL OR _tables IS NULL OR _extras IS NULL OR _reason IS NULL THEN RAISE EXCEPTION 'Dati decisione non validi'; END IF;
 IF auth.uid() IS NULL OR NOT(public.is_super_admin() OR EXISTS(SELECT 1 FROM public.restaurant_members WHERE restaurant_id=_restaurant_id AND user_id=auth.uid() AND status='active')) THEN RAISE EXCEPTION 'Non autorizzato'; END IF;
 PERFORM set_config('segnatavolo.online_decision','on',true);
 PERFORM pg_advisory_xact_lock(hashtextextended(_restaurant_id::text,0));
 SELECT * INTO r FROM public.reservations WHERE id=_id AND restaurant_id=_restaurant_id AND channel='online' AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND OR r.status<>'pending' THEN RAISE EXCEPTION 'Richiesta già gestita o non disponibile'; END IF;
 IF NOT _accept AND length(trim(_reason)) NOT BETWEEN 2 AND 1000 THEN RAISE EXCEPTION 'Inserisci una motivazione'; END IF;
 IF _accept AND NOT public.online_service_open(_restaurant_id,r.date,r.shift) THEN RAISE EXCEPTION 'Servizio chiuso per questa data'; END IF; IF _accept THEN UPDATE public.reservations SET duration_min=public.online_booking_duration(_restaurant_id,r.date,r.shift,r.time) WHERE id=r.id; SELECT * INTO r FROM public.reservations WHERE id=r.id; PERFORM public.validate_online_assignment(_restaurant_id,_id,_tables,_extras);
  IF cardinality(_tables)=0 OR cardinality(_tables)<>(SELECT count(DISTINCT v) FROM unnest(_tables) v) OR EXISTS(SELECT 1 FROM unnest(_tables) tid WHERE NOT EXISTS(SELECT 1 FROM public.restaurant_tables WHERE id=tid AND restaurant_id=_restaurant_id)) THEN RAISE EXCEPTION 'Seleziona tavoli validi'; END IF;
  SELECT settings INTO st FROM public.restaurants WHERE id=_restaurant_id; d:=coalesce((st->>'duration')::int,90); b:=coalesce((st->>'buffer')::int,15);
  IF coalesce((_extras->>'extra_sponde')::int,0) NOT BETWEEN 0 AND 20 OR coalesce((_extras->>'extra_barelle')::int,0) NOT BETWEEN 0 AND 20 OR coalesce((_extras->>'barella_seats')::int,2) NOT BETWEEN 0 AND 20 THEN RAISE EXCEPTION 'Posti extra non validi'; END IF;
  SELECT coalesce(sum(CASE WHEN cardinality(_tables)>1 OR NOT posti_scomodi_solo_in_unione THEN greatest(coperti_max,coperti_comodi,seats) ELSE greatest(coperti_comodi,seats) END),0) INTO cap FROM public.restaurant_tables WHERE restaurant_id=_restaurant_id AND id=ANY(_tables);
  IF cap+coalesce((_extras->>'extra_sponde')::int,0)+coalesce((_extras->>'extra_barelle')::int,0)*coalesce((_extras->>'barella_seats')::int,2)<r.people THEN RAISE EXCEPTION 'Tavoli insufficienti per i coperti richiesti'; END IF;
  IF EXISTS(SELECT 1 FROM public.restaurant_tables t JOIN public.rooms room ON room.id=t.room_id WHERE t.id=ANY(_tables) AND (NOT public.room_service_open(room,r.date,r.shift))) THEN RAISE EXCEPTION 'Una sala selezionata è chiusa'; END IF;
  SELECT EXISTS(SELECT 1 FROM public.reservations o WHERE o.restaurant_id=_restaurant_id AND o.date=r.date AND o.status='confirmed' AND o.deleted_at IS NULL AND NOT(o.no_show AND NOT o.arrived) AND o.id<>r.id AND o.table_ids && _tables AND (r.time='' OR o.time='' OR (split_part(r.time,':',1)::int*60+split_part(r.time,':',2)::int < CASE WHEN coalesce(o.duration_min,d)<0 THEN 1440 ELSE split_part(o.time,':',1)::int*60+split_part(o.time,':',2)::int+coalesce(o.duration_min,d)+coalesce(o.buffer_min,b) END AND split_part(o.time,':',1)::int*60+split_part(o.time,':',2)::int < CASE WHEN coalesce(r.duration_min,d)<0 THEN 1440 ELSE split_part(r.time,':',1)::int*60+split_part(r.time,':',2)::int+coalesce(r.duration_min,d)+coalesce(r.buffer_min,b) END))) INTO conflict;
  IF conflict THEN RAISE EXCEPTION 'Il tavolo è stato occupato: scegli un altro tavolo'; END IF;
 END IF;
 UPDATE public.reservations SET status=CASE WHEN _accept THEN 'confirmed' ELSE 'rejected' END,table_ids=CASE WHEN _accept THEN _tables ELSE '{}' END,extra_sponde=CASE WHEN _accept THEN coalesce((_extras->>'extra_sponde')::int,0) ELSE 0 END,extra_barelle=CASE WHEN _accept THEN coalesce((_extras->>'extra_barelle')::int,0) ELSE 0 END,barella_seats=coalesce((_extras->>'barella_seats')::int,2),rejection_reason=CASE WHEN _accept THEN NULL ELSE trim(_reason) END,decided_at=now() WHERE id=r.id;
 PERFORM set_config('segnatavolo.online_decision','off',true);
 RETURN jsonb_build_object('id',r.id,'status',CASE WHEN _accept THEN 'confirmed' ELSE 'rejected' END);
END $function$;