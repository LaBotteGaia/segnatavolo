import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { normalizeSettings } from "@/lib/data";
import type { Tables } from "@/integrations/supabase/types";

export type Member = Tables<"restaurant_members">;
export type Invite = Tables<"restaurant_invites">;
export type Role = "master" | "staff";

export const roleLabel = (r: string) => (r === "master" ? "Master" : "Staff");

export const membershipQuery = () => ({
  queryKey: ["membership"],
  queryFn: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return null;
    const { data, error } = await supabase
      .from("restaurant_members")
      .select("*, restaurants(name, settings)")
      .eq("user_id", u.user.id)
      .maybeSingle();
    if (error) throw error;
    return data as (Member & { restaurants: { name: string; settings: unknown } | null }) | null;
  },
});

export function useMembership() {
  return useQuery(membershipQuery());
}

export function inviteLink(token: string) {
  return `${window.location.origin}/invito/${token}`;
}

export function useSettings() {
  const { data } = useMembership();
  return normalizeSettings(data?.restaurants?.settings);
}
