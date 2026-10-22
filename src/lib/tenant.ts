import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getAssist, useAssist } from "./assist";

export const EMPTY_RESTAURANT_ID = "00000000-0000-0000-0000-000000000000";

/** Resolve the caller's real membership without reading globally visible member rows. */
export async function ownRestaurantId(): Promise<string | null> {
  const { data, error } = await supabase.rpc("my_restaurant_id");
  if (error) throw error;
  return data || null;
}

export async function activeRestaurantId(): Promise<string | null> {
  return getAssist()?.id ?? await ownRestaurantId();
}

export function scopeRestaurant<Q extends { eq: (col: string, val: string) => Q }>(query: Q, id: string | null | undefined): Q {
  return query.eq("restaurant_id", id || EMPTY_RESTAURANT_ID);
}

export function useActiveRestaurantId() {
  const assist = useAssist();
  const own = useQuery({ queryKey: ["own-restaurant-id"], queryFn: ownRestaurantId, enabled: !assist });
  return assist?.id ?? own.data ?? null;
}