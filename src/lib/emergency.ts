import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { activeShifts, compareTables, shiftCounters, shiftName, type Reservation, type RestaurantSettings, type Room, type RTable, type Shift } from "./data";
import { fmt, interval, isRoomClosedFor } from "./rotation";

export const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);

export function emergencyHtml({ name, date, shifts, rows, rooms, tables, settings }: {
  name: string; date: string; shifts?: Shift[] | undefined; rows: Reservation[]; rooms: Room[]; tables: RTable[]; settings: RestaurantSettings;
}) {
  const esc = escapeHtml;
  const orderedTables = [...tables].sort(compareTables(rooms));
  const cfg = { duration: settings.duration, buffer: settings.buffer };
  const booking = (r: Reservation) => {
    const slot = interval(r, cfg);
    return `<tr><td>${esc(r.time)}</td><td>${r.duration_min === -1 ? "Fine servizio" : esc(fmt(slot.end))}</td><td>${esc(fmt(slot.free))}</td><td>${esc(r.name)}${r.arrived ? " · Arrivato" : ""}${r.no_show ? " · No-Show" : ""}</td><td>${r.people}</td><td>${esc(r.notes)}</td></tr>`;
  };
  const header = "<tr><th>Arrivo</th><th>Fine permanenza</th><th>Libero dalle</th><th>Cliente / Stato</th><th>Coperti</th><th>Note</th></tr>";
  const content = (shifts ?? activeShifts(settings)).map((shift) => {
    const bookings = rows.filter((r) => r.shift === shift);
    const count = shiftCounters(bookings);
    return `<section><h2>${esc(shiftName(shift))} · ${esc(format(parseISO(date), "EEEE dd/MM/yyyy", { locale: it }))}</h2><p>Coperti: ${count.total} · Interni: ${count.inside} · Fuori: ${count.outside} · Da arrivare: ${count.pending}</p>${rooms.map((room) => {
      const ts = orderedTables.filter((t) => t.room_id === room.id);
      const walls = Array.isArray(room.walls) ? room.walls.filter((x): x is string => typeof x === "string") : [];
      const cols = Math.max(1, room.grid_cols); const nr = Math.max(1, room.grid_rows);
      const grid = Array.from({ length: nr }, (_, y) => `<tr>${Array.from({ length: cols }, (_, x) => {
        const table = ts.find((t) => t.x === x && t.y === y);
        const assigned = table ? bookings.filter((r) => !r.no_show && r.table_ids.includes(table.id)) : [];
        const edges = [walls.includes(`h:${x}:${y}`) ? "wall-top" : "", walls.includes(`h:${x}:${y + 1}`) ? "wall-bottom" : "", walls.includes(`v:${x}:${y}`) ? "wall-left" : "", walls.includes(`v:${x + 1}:${y}`) ? "wall-right" : ""].join(" ");
        return `<td class="${edges}">${walls.includes(`o:${x}:${y}`) ? "×" : table ? `<b>${esc(table.name)}</b><small>${table.seats} posti${assigned.length ? `<br>${assigned.map((r) => `${esc(r.time)} ${esc(r.name)} (${r.people}p)`).join("<br>")}` : "<br>Libero"}</small>` : ""}</td>`;
      }).join("")}</tr>`).join("");
      return `<h3>${esc(room.name)}${isRoomClosedFor(room, date, shift) ? " — Sala chiusa" : ""}</h3><div class="map"><table class="grid">${grid}</table></div>${ts.map((t) => {
        const assigned = bookings.filter((r) => r.table_ids.includes(t.id)).sort((a, b) => a.time.localeCompare(b.time));
        return `<h4>Tavolo ${esc(t.name)} · ${t.seats} posti</h4><table>${header}${assigned.length ? assigned.map(booking).join("") : '<tr><td colspan="6">Libero</td></tr>'}</table>`;
      }).join("")}`;
    }).join("")}${bookings.some((r) => !r.table_ids.length) ? `<h3>Tavolo da assegnare</h3><table>${header}${bookings.filter((r) => !r.table_ids.length).map(booking).join("")}</table>` : ""}</section>`;
  }).join("");
  return `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Piano di Sala — ${esc(name)}</title><style>:root{--paper:#fff;--ink:#000;--line:#777}*{box-sizing:border-box}body{font:16px Arial,sans-serif;color:var(--ink);background:var(--paper);margin:24px}h1{font-size:26px}h2{border-bottom:2px solid var(--ink);padding-bottom:8px}h3{margin-top:24px}h4{margin-bottom:6px}table{border-collapse:collapse;width:100%;font-size:13px}th,td{border:1px solid var(--line);padding:7px;text-align:left;overflow-wrap:anywhere}th{font-weight:bold}.map{overflow:auto;margin:12px 0}.grid{table-layout:fixed;min-width:360px}.grid td{height:55px;text-align:center;padding:3px;font-size:11px}.grid small{display:block}.wall-top{border-top:4px solid var(--ink)}.wall-bottom{border-bottom:4px solid var(--ink)}.wall-left{border-left:4px solid var(--ink)}.wall-right{border-right:4px solid var(--ink)}@page{size:A4;margin:12mm}@media print{body{margin:0}section+section{break-before:page}tr,h4{break-inside:avoid}.map{overflow:visible}.grid{min-width:0}}</style></head><body><h1>${esc(name)} — Piano di Sala (Emergenza)</h1><p>Copia locale del ${esc(format(new Date(), "dd/MM/yyyy HH:mm"))}</p>${content}</body></html>`;
}

export function downloadEmergency(input: Parameters<typeof emergencyHtml>[0]) {
  const url = URL.createObjectURL(new Blob([emergencyHtml(input)], { type: "text/html;charset=utf-8" }));
  const a = document.createElement("a"); a.href = url; a.download = `segnatavolo-emergenza-${input.date}.html`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}