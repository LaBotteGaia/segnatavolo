import { createFileRoute, Link, Navigate } from '@tanstack/react-router';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RestaurantGate } from '@/components/RestaurantGate';
import { AssignmentRulesEditor } from '@/components/AssignmentRulesEditor';
import { useMembership } from '@/lib/membership';
import { useIsSuperAdmin } from '@/lib/assist';

export const Route = createFileRoute('/_authenticated/regole')({
  head: () => ({ meta: [{title:'Regole di Assegnazione Sala — Segnatavolo'},{name:'description',content:'Regole del ristorante per sedute lunghe, tavoli isola e gruppi piccoli.'},{property:'og:title',content:'Regole di Assegnazione Sala — Segnatavolo'},{property:'og:description',content:'Configurazione riservata delle priorità di assegnazione dei tavoli.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}] }),
  component: () => <RestaurantGate><RulesPage/></RestaurantGate>,
});
function RulesPage() {
  const {data:me,isPending} = useMembership();
  const {data:superAdmin,isPending:adminPending} = useIsSuperAdmin();
  if (isPending || adminPending) return null;
  if (!me || (me.role!=='master' && !superAdmin)) return <Navigate to="/agenda"/>;
  return <main className="min-h-screen w-full bg-background px-3 py-6 sm:px-6 lg:px-8"><Button asChild variant="outline" className="mb-6"><Link to="/agenda"><ArrowLeft/> Agenda</Link></Button><div className="mb-8 flex flex-wrap items-start justify-between gap-3 border-b pb-6"><div><p className="mb-2 text-sm text-muted-foreground">{me.restaurants?.name}</p><h1 className="font-display text-3xl">Regole di Assegnazione Sala</h1></div><span className="flex items-center gap-2 text-sm font-semibold text-primary"><ShieldCheck className="size-4"/> Riservato Master</span></div><div className="max-w-4xl"><AssignmentRulesEditor/></div></main>;
}