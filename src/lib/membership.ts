import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { normalizeSettings } from "@/lib/data";
import { getAssist } from "@/lib/assist";
import type { Tables } from "@/integrations/supabase/types";

export type Member = Tables<"restaurant_members">;
export type Invite = Tables<"restaurant_invites">;
export type Role = "master" | "staff";

export const roleLabel = (r: string) => (r === "master" ? "Master" : "Staff");

export const membershipQuery = () => {
  const assist = getAssist();
  return {
    queryKey: ["membership", assist?.id ?? "own"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      // Modalità Assistenza: il Super Admin vede il ristorante scelto come se fosse il suo.
      if (assist) {
        const { data: r, error } = await supabase.from("restaurants").select("id, name, settings").eq("id", assist.id).maybeSingle();
        if (error) throw error;
        if (!r) return null;
        return {
          id: `assist-${r.id}`,
          restaurant_id: r.id,
          user_id: u.user.id,
          name: "Assistenza",
          email: u.user.email ?? "",
          role: "master",
          status: "active",
          created_at: "",
          restaurants: { name: r.name, settings: r.settings },
        } as Member & { restaurants: { name: string; settings: unknown } | null };
      }
      const { data, error } = await supabase
        .from("restaurant_members")
        .select("*, restaurants(name, settings)")
        .eq("user_id", u.user.id)
        .maybeSingle();
      if (error) throw error;
      return data as (Member & { restaurants: { name: string; settings: unknown } | null }) | null;
    },
  };
};

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
