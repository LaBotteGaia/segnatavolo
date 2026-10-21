import { useQuery, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { serviceClock } from "./no-show";
import { LIVE_QUERY_KEYS } from "./live-sync";
import { useMembership } from "./membership";

export function useRecycleBin(now: Date, enabled: boolean) {
  const restaurantId = useMembership().data?.restaurant_id;
  const today = serviceClock(now).date;
  return useQuery({
    queryKey: ["recycle-bin", restaurantId, today], enabled: enabled && !!restaurantId,
    queryFn: async () => {
      // Fetch deleted rows only; Europe/Rome day is filtered without UTC-boundary assumptions.
      const { data, error } = await supabase.from("reservations").select("*").eq("restaurant_id", restaurantId ?? "").not("deleted_at", "is", null).order("deleted_at", { ascending: false });
      if (error) throw error;
      return data.filter((r) => r.deleted_at && serviceClock(new Date(r.deleted_at)).date === today);
    },
  });
}
export function refreshService(qc: QueryClient) {
  return Promise.all(LIVE_QUERY_KEYS.map((key) => qc.invalidateQueries({ queryKey: [key] })));
}
export async function restoreReservation(id: string, withoutTables = false) {
  const { data, error } = await supabase.rpc("restore_service_reservation", { _id: id, _without_tables: withoutTables });
  if (error) throw error;
  return data;
}