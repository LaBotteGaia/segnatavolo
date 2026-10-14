import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Public by design: the secret invite token is the credential.
export const acceptInvite = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ token: z.string().min(10).max(100), password: z.string().min(6).max(72) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inv } = await supabaseAdmin
      .from("restaurant_invites")
      .select("*")
      .eq("token", data.token)
      .is("accepted_at", null)
      .maybeSingle();
    if (!inv) return { ok: false as const, error: "Invito non valido o già usato" };

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: inv.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { name: inv.name },
    });
    if (error || !created.user) {
      return { ok: false as const, error: "Esiste già un account con questa email. Chiedi al Master un invito con un'altra email." };
    }
    const { error: mErr } = await supabaseAdmin.from("restaurant_members").insert({
      restaurant_id: inv.restaurant_id,
      user_id: created.user.id,
      name: inv.name,
      email: inv.email,
      role: inv.role,
    });
    if (mErr) {
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      return { ok: false as const, error: "Impossibile completare l'invito" };
    }
    await supabaseAdmin.from("restaurant_invites").update({ accepted_at: new Date().toISOString() }).eq("id", inv.id);
    return { ok: true as const, email: inv.email };
  });
