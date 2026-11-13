import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { AlertTriangle, Camera, Check, Copy, Lightbulb, Loader2, Map as MapIcon, PenLine } from 'lucide-react';
import { TableDialog } from './TableDialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useActiveRestaurantId } from '@/lib/tenant';
import { useSettings } from '@/lib/membership';
import { NO_EXTRAS, rangesOf, shiftName, tableLabel, timeSlots, useActiveCustomRules, useRooms, useTables, wallsOf, type Reservation, type Shift, type TableExtras } from '@/lib/data';
import { suggestTables } from '@/lib/allocation';
import { readAgendaPhoto } from '@/lib/agenda-photo.functions';
import { mergeRepeats, normPhone, normTime, samePerson, type PhotoRow } from '@/lib/agenda-photo';

type Draft = { key: string; include: boolean; name: string; phone: string; people: string; time: string; shift: Shift; notes: string; uncertain: string[]; crossed: boolean; dup: Reservation | null; updateDup: boolean; tables: string[]; extras: TableExtras; hint: string | null };

async function toJpeg(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = url; });
    const k = Math.min(1, 2000 / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.85).split(',')[1] ?? '';
  } finally { URL.revokeObjectURL(url); }
}

export function AgendaPhotoImport({ date, shifts, fallbackShift, onDone, className }: { date: string; shifts: Shift[]; fallbackShift: Shift; onDone: (date: string, shift: Shift) => void; className?: string }) {
  const restaurantId = useActiveRestaurantId();
  const settings = useSettings();
  const { data: rooms } = useRooms();
  const { data: tables } = useTables();
  const customRules = useActiveCustomRules();
  const qc = useQueryClient();
  const read = useServerFn(readAgendaPhoto);
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<'' | 'read' | 'save'>('');
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState('');
  const [day, setDay] = useState(date);
  const [rows, setRows] = useState<Draft[]>([]);
  const [existing, setExisting] = useState<Reservation[]>([]);
  const [mapKey, setMapKey] = useState<string | null>(null);
  const ranges = rangesOf(settings);
  /** Esterno solo se richiesto a mano: di default si preferiscono le sale interne. */
  const wantsOutside = (notes: string) => /\b(fuori|dehors|esterno|esterni|terrazza|giardino|veranda|aperto)\b/i.test(notes);
  const shiftOf = (time: string, fallback: Shift) => shifts.find(s => time && timeSlots(s, ranges).includes(time)) ?? fallback;

  const loadDay = async (d: string) => {
    const { data, error } = await supabase.from('reservations').select('*').eq('restaurant_id', restaurantId ?? '').eq('date', d).is('deleted_at', null).neq('status', 'rejected');
    if (error) throw error;
    return data;
  };
  /** Suggerisce in sequenza: ogni tavolo proposto occupa la sala per le righe successive. */
  const suggestAll = (list: Draft[], d: string, others: Reservation[], only?: string) => {
    if (!tables || !rooms) return list;
    const taken: { id: string; name: string; table_ids: string[]; time: string }[] = others.filter(o => o.status === 'confirmed').map(o => ({ id: o.id, name: o.name, table_ids: o.table_ids, time: o.time, duration_min: o.duration_min, buffer_min: o.buffer_min, no_show: o.no_show, tavolo_bloccato: o.tavolo_bloccato }));
    return list.map(r => {
      const people = Number(r.people);
      if (!r.include || r.dup) return r;
      if (only && only !== r.key) { if (r.tables.length) taken.push({ id: r.key, name: r.name, table_ids: r.tables, time: r.time }); return r; }
      const others2 = taken.filter(t => (others.find(o => o.id === t.id)?.shift ?? list.find(x => x.key === t.id)?.shift) === r.shift);
      const s = r.time && people > 0 ? suggestTables({ people, date: d, shift: r.shift, time: r.time, tables, rooms, others: others2, cfg: settings, outside: wantsOutside(r.notes), notes: r.notes, rules: settings.assignmentRules, customRules, wallsFor: id => wallsOf(rooms.find(x => x.id === id)) }) : null;
      const next = { ...r, tables: s?.ids ?? [], extras: s?.extras ?? NO_EXTRAS };
      if (next.tables.length) taken.push({ id: r.key, name: r.name, table_ids: next.tables, time: r.time });
      return next;
    });
  };

  const build = (src: PhotoRow[], pageShift: Shift, others: Reservation[]): Draft[] => mergeRepeats(src).map((r, i) => {
    const time = r.time ?? '';
    const shift = r.shift && shifts.includes(r.shift) ? r.shift : shiftOf(time, pageShift);
    const dup = r.crossed_out ? null : others.find(o => o.shift === shift && samePerson(r, { name: o.name, phone: o.phone, time: o.time })) ?? null;
    return { key: `p${i}`, include: !r.crossed_out && !dup, name: r.name, phone: r.phone ?? '', people: r.people ? String(r.people) : '', time, shift, notes: [r.notes, r.table_hint ? `Tav. scritto: ${r.table_hint}` : ''].filter(Boolean).join(' · '), uncertain: r.uncertain, crossed: r.crossed_out, dup, updateDup: false, tables: [], extras: NO_EXTRAS, hint: r.table_hint };
  });

  const onFile = async (file: File | undefined) => {
    if (!file || !restaurantId) return;
    setBusy('read');
    try {
      const image = await toJpeg(file);
      setPreview(`data:image/jpeg;base64,${image}`);
      const r = await read({ data: { restaurant_id: restaurantId, agenda_date: date, mime: 'image/jpeg', image } });
      if (!r.ok) { toast.error(r.message); return; }
      if (!r.result.rows.length) { toast.info('Nessuna prenotazione scritta a mano trovata nella foto.'); return; }
      const d = r.result.date ?? date;
      const others = await loadDay(d);
      const pageShift = r.result.shift && shifts.includes(r.result.shift) ? r.result.shift : fallbackShift;
      setDay(d); setExisting(others);
      setRows(suggestAll(build(r.result.rows, pageShift, others), d, others));
      setOpen(true);
      if (r.result.date && r.result.date !== date) toast.info(`La pagina fotografata è del ${r.result.date.split('-').reverse().join('/')}: controlla la data prima di sincronizzare.`);
    } catch { toast.error('Lettura della foto non riuscita: controlla la connessione e riprova.'); }
    finally { setBusy(''); if (input.current) input.current.value = ''; }
  };

  const changeDay = async (d: string) => {
    setDay(d);
    try { const others = await loadDay(d); setExisting(others); setRows(rs => suggestAll(rs.map(r => { const dup = r.crossed ? null : others.find(o => o.shift === r.shift && samePerson({ name: r.name, phone: r.phone, time: r.time }, o)) ?? null; return { ...r, dup, include: r.include && !dup, updateDup: false }; }), d, others)); }
    catch { toast.error('Agenda del giorno non raggiungibile'); }
  };
  const patch = (key: string, p: Partial<Draft>, field?: string) => setRows(rs => rs.map(r => r.key === key ? { ...r, ...p, uncertain: p.uncertain !== undefined ? p.uncertain : field ? r.uncertain.filter(u => u !== field) : r.uncertain } : r));
  const missing = (r: Draft) => [!r.name.trim() && 'nome', !(Number(r.people) >= 1) && 'persone', !normTime(r.time) && 'orario'].filter(Boolean) as string[];
  const chosen = rows.filter(r => r.include && !r.dup);
  const updates = rows.filter(r => r.dup && r.updateDup);
  const blocked = chosen.filter(r => r.uncertain.length || missing(r).length);

  const save = async () => {
    if (!restaurantId || blocked.length || busy) return;
    setBusy('save');
    let ok = 0, fail = 0;
    try {
      for (const r of chosen) {
        const phone = normPhone(r.phone) || null;
        let customerId: string | null = null;
        if (phone) {
          const { data: c } = await supabase.from('customers').select('id').eq('restaurant_id', restaurantId).in('phone', [phone, r.phone.trim()]).limit(1).maybeSingle();
          customerId = c?.id ?? null;
        }
        if (!customerId) { const { data: c } = await supabase.from('customers').insert({ name: r.name.trim(), phone, restaurant_id: restaurantId }).select('id').single(); customerId = c?.id ?? null; }
        const { error } = await supabase.from('reservations').insert({ restaurant_id: restaurantId, date: day, shift: r.shift, time: normTime(r.time)!, name: r.name.trim(), people: Number(r.people), phone, notes: r.notes, customer_id: customerId, table_ids: r.tables, ...r.extras, is_new: !customerId, outside: false, tags: [] });
        if (error) fail++; else ok++;
      }
      for (const r of updates) {
        const d = r.dup!; const phone = normPhone(r.phone);
        const p: Partial<Reservation> = {};
        if (!d.phone && phone) p.phone = phone;
        if (r.notes && !(d.notes ?? '').includes(r.notes)) p.notes = [d.notes, r.notes].filter(Boolean).join(' · ');
        if (Number(r.people) >= 1 && Number(r.people) !== d.people) p.people = Number(r.people);
        if (Object.keys(p).length) { const { error } = await supabase.from('reservations').update(p).eq('id', d.id).eq('restaurant_id', restaurantId); if (error) fail++; else ok++; }
      }
      await qc.invalidateQueries();
      if (fail) toast.error(`${fail} righe non salvate: controlla l'agenda e riprova.`);
      if (ok) toast.success(`Agenda sincronizzata: ${ok} ${ok === 1 ? 'prenotazione' : 'prenotazioni'}`);
      if (!fail) { setOpen(false); onDone(day, chosen[0]?.shift ?? fallbackShift); }
    } finally { setBusy(''); }
  };

  const tableOptions = (tables ?? []).slice().sort((a, b) => a.name.localeCompare(b.name, 'it', { numeric: true }));
  const warn = (r: Draft, f: string) => r.uncertain.includes(f) && 'border-2 border-warning bg-warning/10';

  return <>
    <input ref={input} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => void onFile(e.target.files?.[0])} />
    <Button variant="secondary" className={cn('whitespace-nowrap px-3', className)} disabled={!!busy || !shifts.length} title="Sincronizza da foto della pagina d'agenda" onClick={() => input.current?.click()}>
      {busy === 'read' ? <Loader2 className="animate-spin" /> : <Camera />} <span className="agenda-wide:hidden">Foto</span><span className="hidden agenda-wide:inline">Foto Agenda</span>
    </Button>
    {busy === 'read' && <div role="status" className="fixed inset-x-0 bottom-4 z-50 mx-auto w-fit rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground shadow-lg">📖 Leggo la pagina dell'agenda…</div>}
    <Dialog open={open} onOpenChange={o => !busy && setOpen(o)}>
      <DialogContent className="max-h-[92dvh] max-w-6xl overflow-hidden p-0">
        <div className="flex max-h-[92dvh] flex-col">
          <DialogHeader className="border-b p-4">
            <DialogTitle>Sincronizza dalla foto</DialogTitle>
            <DialogDescription>Controlla i dati letti: i campi gialli sono incerti e vanno confermati. Nulla viene salvato prima della conferma.</DialogDescription>
          </DialogHeader>
          <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            {preview && <a href={preview} target="_blank" rel="noreferrer" className="block"><img src={preview} alt="Pagina d'agenda fotografata" className="max-h-[70dvh] w-full rounded-md border object-contain" /></a>}
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm font-semibold">Data della pagina <Input type="date" value={day} onChange={e => e.target.value && void changeDay(e.target.value)} className="w-auto" /></label>
              {rows.map(r => {
                const miss = missing(r);
                return <div key={r.key} className={cn('space-y-2 rounded-lg border bg-card p-3', !r.include && !r.updateDup && 'opacity-70')}>
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                    {r.dup ? <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5"><Copy className="h-3 w-3" /> Già in agenda: {r.dup.name} {r.dup.time.slice(0, 5)} · {r.dup.people}p</span>
                      : r.crossed ? <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5"><PenLine className="h-3 w-3" /> Barrata a penna</span>
                      : r.uncertain.length ? <span className="inline-flex items-center gap-1 rounded-full bg-warning/20 px-2 py-0.5"><AlertTriangle className="h-3 w-3" /> Da verificare</span>
                      : <span className="inline-flex items-center gap-1 rounded-full bg-free/15 px-2 py-0.5"><Check className="h-3 w-3" /> Nuova</span>}
                    <span className="ml-auto" />
                    {r.dup ? <label className="flex items-center gap-1"><input type="checkbox" checked={r.updateDup} onChange={e => patch(r.key, { updateDup: e.target.checked })} /> Aggiorna dati mancanti</label>
                      : <label className="flex items-center gap-1"><input type="checkbox" checked={r.include} onChange={e => setRows(rs => suggestAll(rs.map(x => x.key === r.key ? { ...x, include: e.target.checked } : x), day, existing, r.key))} /> Importa</label>}
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-[2fr_1fr_1fr_2fr]">
                    <Input aria-label="Nome" placeholder="Nome" value={r.name} className={cn('col-span-2 sm:col-span-1', warn(r, 'name'))} onChange={e => patch(r.key, { name: e.target.value }, 'name')} />
                    <Input aria-label="Persone" inputMode="numeric" placeholder="Pax" value={r.people} className={cn(warn(r, 'people'))} onChange={e => patch(r.key, { people: e.target.value.replace(/\D/g, '') }, 'people')} onBlur={() => r.include && setRows(rs => suggestAll(rs, day, existing, r.key))} />
                    <Input aria-label="Orario" placeholder="HH:MM" value={r.time} className={cn(warn(r, 'time'))} onChange={e => patch(r.key, { time: e.target.value }, 'time')} onBlur={() => { const t = normTime(r.time); if (t) setRows(rs => suggestAll(rs.map(x => x.key === r.key ? { ...x, time: t, shift: shiftOf(t, x.shift) } : x), day, existing, r.key)); }} />
                    <Input aria-label="Telefono" inputMode="tel" placeholder="Telefono" value={r.phone} className={cn('col-span-2 sm:col-span-1', warn(r, 'phone'))} onChange={e => patch(r.key, { phone: e.target.value }, 'phone')} />
                  </div>
                  <Input aria-label="Note" placeholder="Note" value={r.notes} onChange={e => patch(r.key, { notes: e.target.value })} />
                  {r.include && !r.dup && <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-muted-foreground">{shiftName(r.shift)} ·</span>
                    <select aria-label="Tavolo" className="h-9 min-w-0 flex-1 rounded-md border bg-background px-2" value={r.tables.join(',')} onChange={e => patch(r.key, { tables: e.target.value ? e.target.value.split(',') : [], extras: NO_EXTRAS })}>
                      <option value="">Senza tavolo</option>
                      {r.tables.length > 1 && <option value={r.tables.join(',')}>💡 {tableLabel(r.tables, tables, rooms)}</option>}
                      {tableOptions.map(t => <option key={t.id} value={t.id}>{r.tables.length === 1 && r.tables[0] === t.id ? '💡 ' : ''}Tavolo {t.name} · {rooms?.find(x => x.id === t.room_id)?.name ?? ''} ({t.coperti_comodi ?? t.seats}p)</option>)}
                    </select>
                    <Button type="button" size="sm" variant="outline" onClick={() => setMapKey(r.key)}><MapIcon /> Mappa Sale</Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => setRows(rs => suggestAll(rs, day, existing, r.key))}><Lightbulb /> Suggerisci</Button>
                    {r.uncertain.length > 0 && <Button type="button" size="sm" variant="outline" className="border-warning" onClick={() => patch(r.key, { uncertain: [] })}><Check /> Dati corretti</Button>}
                  </div>}
                  {r.include && !r.dup && miss.length > 0 && <p className="text-xs text-destructive">Manca: {miss.join(', ')}</p>}
                </div>;
              })}
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 border-t p-4">
            {blocked.length > 0 && <span className="mr-auto text-sm text-muted-foreground">{blocked.length} {blocked.length === 1 ? 'riga da verificare' : 'righe da verificare'}</span>}
            <Button variant="outline" disabled={!!busy} onClick={() => setOpen(false)}>Annulla</Button>
            <Button disabled={!!busy || blocked.length > 0 || chosen.length + updates.length === 0} onClick={() => void save()}>{busy === 'save' && <Loader2 className="animate-spin" />} Sincronizza {chosen.length + updates.length} in agenda</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    {(() => {
      const r = rows.find(x => x.key === mapKey);
      if (!r) return null;
      const others = [
        ...existing.filter(o => o.status === 'confirmed' && o.shift === r.shift),
        ...rows.filter(x => x.key !== r.key && x.include && !x.dup && x.shift === r.shift && x.tables.length).map(x => ({ id: x.key, name: x.name, table_ids: x.tables, time: normTime(x.time) ?? x.time })),
      ];
      return <TableDialog open onOpenChange={o => !o && setMapKey(null)} date={day}
        reservation={{ id: r.key, name: r.name || 'Prenotazione', people: Number(r.people) || 1, shift: r.shift, table_ids: r.tables, time: normTime(r.time) ?? r.time, notes: r.notes, outside: wantsOutside(r.notes) }}
        others={others} extras={r.extras}
        onConfirm={(ids, ex) => { patch(r.key, { tables: ids, extras: ex }); setMapKey(null); }} />;
    })()}
  </>;
}
