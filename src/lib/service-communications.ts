import { localClock } from './booking-policy';
export function unconfirmedWithinHour(row: { channel: string; status: string; arrived: boolean; deleted_at?: string | null; confirmation_status?: string; date: string; time: string }, now: Date, timezone = 'Europe/Rome') {
  const clock = localClock(now, timezone);
  if (row.channel !== 'online' || row.status !== 'confirmed' || row.arrived || row.deleted_at || row.confirmation_status !== 'in_attesa_riconferma' || row.date !== clock.date || !/^([01]\d|2[0-3]):[0-5]\d$/.test(row.time)) return false;
  const remaining = Number(row.time.slice(0, 2)) * 60 + Number(row.time.slice(3)) - clock.minutes;
  return remaining <= 60;
}
export function dailySummary(rows: { time: string; name: string; people: number; shift: string; channel: string; notes: string; customer_notes?: string; table_ids: string[]; customer_id?: string | null }[], tables: { id: string; name: string; room_id: string }[], rooms: { id: string; name: string }[], customers: { id: string; notes: string | null }[] = []) {
  const totals = ['colazione', 'pranzo', 'sera'].map(shift => { const list = rows.filter(r => r.shift === shift); return `${shift === 'sera' ? 'Cena' : shift === 'pranzo' ? 'Pranzo' : 'Colazione'}: ${list.length} prenotazioni · ${list.reduce((n, r) => n + r.people, 0)} coperti`; }).join('\n');
  const lines = [...rows].sort((a, b) => a.time.localeCompare(b.time) || a.name.localeCompare(b.name)).map(r => {
    const places = r.table_ids.map(id => { const t = tables.find(t => t.id === id); return t ? `T. ${t.name} / ${rooms.find(room => room.id === t.room_id)?.name ?? 'Sala'}` : 'Da assegnare'; }).join(' + ') || 'Da assegnare';
    const notes = [...new Set([r.notes, r.customer_notes, customers.find(c => c.id === r.customer_id)?.notes].filter(Boolean))].join(' · ');
    return `${r.time || '—'} | ${r.name} | ${r.people} pax | ${places} | ${r.channel === 'online' ? '🌐 ONLINE' : 'Manuale'}\nNote / Allergie: ${notes || '—'}`;
  }).join('\n\n');
  return `${totals}\n\nORARIO | NOME | PAX | TAVOLO / SALA | CANALE\n\n${lines || 'Nessuna prenotazione.'}`;
}