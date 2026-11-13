import { z } from 'zod';

/** Riga letta dalla foto di una pagina d'agenda cartacea. */
export type PhotoRow = {
  name: string; phone: string | null; people: number | null; time: string | null;
  shift: 'colazione' | 'pranzo' | 'sera' | null; notes: string; table_hint: string | null;
  crossed_out: boolean; uncertain: string[];
};
export type PhotoResult = { date: string | null; shift: 'colazione' | 'pranzo' | 'sera' | null; rows: PhotoRow[] };

export function photoPrompt(agendaDate: string) {
  return `Sei l'assistente di un ristorante italiano. Ricevi la FOTO di una pagina di agenda cartacea delle prenotazioni, scritta a mano. Il layout cambia da ristorante a ristorante: individua le colonne dal significato, non dalla posizione.
Data aperta nell'agenda digitale (usala se la pagina non mostra la data): ${agendaDate}.
ISTRUZIONI:
- Data e servizio: leggi la data stampata o scritta. Il servizio può essere indicato da parole (pranzo, cena, sera) o icone (sole = pranzo, luna = cena). Se non è chiaro usa null.
- Una prenotazione per riga scritta a penna: nome, numero di persone (coperti/pax), orario, telefono, tavolo se indicato, note/richieste.
- IGNORA TUTTI GLI ELEMENTI STAMPATI della carta: loghi, marchi sponsor, slogan, filigrane, pennellate o campiture colorate decorative, righe e icone prestampate. Queste NON sono cancellature.
- crossed_out=true SOLO se sopra il testo scritto a mano c'è un evidente tratto di PENNA (linea che attraversa la scritta, croce, scarabocchio) o la parola annullato/disdetto. Nel dubbio crossed_out=false.
- Orario: formato HH:MM 24h ("2045" = "20:45", "21.00" = "21:00", "1915" = "19:15"). Se illeggibile o non orario (es. sigle) usa null e aggiungi "time" a uncertain.
- Telefono: solo cifre e + iniziale, così come scritto. Se mancano cifre o è dubbio, aggiungilo comunque e metti "phone" in uncertain.
- Persone: intero. Se dubbio, metti "people" in uncertain.
- Nome: come scritto, con iniziali maiuscole. Se dubbio metti "name" in uncertain.
- Testi che non sono telefono, orario o persone (es. sigle, tavoli, nomi aggiuntivi) vanno in notes o table_hint, mai inventati.
- Non inventare righe vuote. Non unire righe diverse.
Rispondi SOLO con JSON: {"date":"YYYY-MM-DD"|null,"shift":"colazione"|"pranzo"|"sera"|null,"rows":[{"name":string,"phone":string|null,"people":number|null,"time":"HH:MM"|null,"shift":"colazione"|"pranzo"|"sera"|null,"notes":string,"table_hint":string|null,"crossed_out":boolean,"uncertain":string[]}]}`;
}

const shiftZ = z.enum(['colazione', 'pranzo', 'sera']).nullable().optional().catch(null);
const rawRow = z.object({
  name: z.string().nullable().optional(), phone: z.union([z.string(), z.number()]).nullable().optional(),
  people: z.union([z.number(), z.string()]).nullable().optional(), time: z.string().nullable().optional(), shift: shiftZ,
  notes: z.string().nullable().optional(), table_hint: z.union([z.string(), z.number()]).nullable().optional(),
  crossed_out: z.boolean().optional(), uncertain: z.array(z.string()).optional(),
});
const rawResult = z.object({ date: z.string().nullable().optional(), shift: shiftZ, rows: z.array(rawRow).max(80).default([]) });

export function normTime(v: string | null | undefined): string | null {
  const m = /^(\d{1,2})\s*[:.,]?\s*(\d{2})$/.exec((v ?? '').trim());
  if (!m) return null;
  const h = Number(m[1]), mi = Number(m[2]);
  return h < 24 && mi < 60 ? `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}` : null;
}
export const normPhone = (v: string | null | undefined) => (v ?? '').replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
const normName = (v: string) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]/g, '');

/** Valida la risposta IA: valori incerti restano marcati, mai inventati. */
export function normalizePhotoResult(input: unknown): PhotoResult {
  const r = rawResult.parse(input);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(r.date ?? '') ? r.date! : null;
  const rows: PhotoRow[] = [];
  for (const x of r.rows) {
    const name = (x.name ?? '').trim().slice(0, 80);
    const phoneRaw = x.phone == null ? '' : normPhone(String(x.phone));
    const peopleN = x.people == null || x.people === '' ? NaN : Math.round(Number(x.people));
    const time = normTime(x.time);
    const uncertain = new Set((x.uncertain ?? []).filter(u => ['name', 'phone', 'people', 'time'].includes(u)));
    if (!name && !phoneRaw) continue;
    if (!name) uncertain.add('name');
    if (!time) uncertain.add('time');
    const people = Number.isFinite(peopleN) && peopleN >= 1 && peopleN <= 200 ? peopleN : null;
    if (people == null) uncertain.add('people');
    const digits = phoneRaw.replace(/\D/g, '');
    if (phoneRaw && (digits.length < 8 || digits.length > 15)) uncertain.add('phone');
    rows.push({ name, phone: phoneRaw || null, people, time, shift: x.shift ?? null, notes: (x.notes ?? '').trim().slice(0, 300), table_hint: x.table_hint == null ? null : String(x.table_hint).trim().slice(0, 30) || null, crossed_out: !!x.crossed_out, uncertain: [...uncertain] });
  }
  return { date, shift: r.shift ?? null, rows };
}

const sameName = (a: string, b: string) => { const x = normName(a), y = normName(b); return !!x && !!y && (x === y || (x.length >= 4 && y.length >= 4 && (x.startsWith(y) || y.startsWith(x)))); };
/** Chiave identità: telefono normalizzato (regola del progetto), altrimenti nome + orario. */
export function samePerson(a: { name: string; phone: string | null; time: string | null }, b: { name: string; phone: string | null; time: string | null }) {
  const pa = normPhone(a.phone).replace(/^\+39/, ''), pb = normPhone(b.phone).replace(/^\+39/, '');
  if (pa.length >= 8 && pb.length >= 8) return pa === pb;
  return sameName(a.name, b.name) && (!a.time || !b.time || a.time.slice(0, 5) === b.time.slice(0, 5));
}

/** Unisce le ripetizioni presenti nella stessa foto, completando i campi mancanti. */
export function mergeRepeats(rows: PhotoRow[]): PhotoRow[] {
  const out: PhotoRow[] = [];
  for (const r of rows) {
    const hit = out.find(o => !o.crossed_out && !r.crossed_out && samePerson(o, r));
    if (!hit) { out.push({ ...r, uncertain: [...r.uncertain] }); continue; }
    const filled = new Set<string>();
    if (hit.phone == null && r.phone) { hit.phone = r.phone; filled.add('phone'); }
    if (hit.people == null && r.people != null) { hit.people = r.people; filled.add('people'); }
    if (hit.time == null && r.time) { hit.time = r.time; filled.add('time'); }
    hit.table_hint ??= r.table_hint;
    if (r.notes && !hit.notes.includes(r.notes)) hit.notes = [hit.notes, r.notes].filter(Boolean).join(' · ');
    hit.uncertain = [...new Set([...hit.uncertain.filter(u => !filled.has(u)), ...r.uncertain.filter(u => filled.has(u))])];
  }
  return out;
}

type BookEntry = { id: string; name: string; first_name?: string | null; last_name?: string | null; phone: string | null; extra_phones?: string[] | null };
const bookName = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean).sort().join(' ');
/** Riconosce il cliente in anagrafica: telefono normalizzato certo; nome solo se univoco. */
export function findCustomerMatch<C extends BookEntry>(book: C[], name: string, phone: string): { customer: C; by: 'phone' | 'name' } | null {
  const p = normPhone(phone);
  if (p.length >= 5) {
    const c = book.find(x => [x.phone, ...(x.extra_phones ?? [])].some(q => q && normPhone(q) === p));
    if (c) return { customer: c, by: 'phone' };
    return null;
  }
  const n = bookName(name);
  if (!n) return null;
  const same = book.filter(x => bookName(x.name) === n || bookName(`${x.first_name ?? ''} ${x.last_name ?? ''}`) === n);
  return same.length === 1 ? { customer: same[0]!, by: 'name' } : null;
}
