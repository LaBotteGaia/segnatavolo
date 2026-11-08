import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { rememberReturnPath } from "@/lib/return-path";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    // Sessione locale: istantanea, nessuna attesa di rete a ogni cambio pagina.
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      rememberReturnPath(location.href);
      throw redirect({ to: "/auth" });
    }
  },
  component: () => <Outlet />,
});
