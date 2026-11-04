import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { BookOpen } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

/** Mostra "Torna all'Agenda" solo agli operatori con sessione attiva. */
export function BackToAgendaLink() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => { supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session)); }, []);
  if (!signedIn) return null;
  return <Link to="/agenda" className="inline-flex shrink-0 items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:opacity-90"><BookOpen className="size-4" />Torna all'Agenda</Link>;
}
