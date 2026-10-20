import { addMonths, format, parseISO } from "date-fns";
import { serviceClock, serviceEnded } from "./no-show";
import type { Ranges, Shift } from "./data";

export function reservationDateWarning(date: string, shift: Shift, time: string, ranges: Ranges, now: Date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const clock = serviceClock(now);
  const [h, m] = time.split(":").map(Number);
  const start = Number(h) * 60 + Number(m);
  if (serviceEnded({ id: "warning", phone: null, date, shift, time, arrived: false }, ranges, now) || (date === clock.date && Number.isFinite(start) && start < clock.minutes)) {
    return { kind: "past" as const, key: `${date}-${shift}-${time}-past`, text: "⚠️ Attenzione: Stai registrando una prenotazione per una data o un turno già trascorsi." };
  }
  if (date > format(addMonths(parseISO(clock.date), 6), "yyyy-MM-dd")) {
    return { kind: "future" as const, key: `${date}-${shift}-${time}-future`, text: `ℹ️ Attenzione: Stai inserendo una prenotazione a più di 6 mesi nel futuro (Data: ${format(parseISO(date), "dd/MM/yyyy")}). Verifica la correttezza dell'anno selezionato.` };
  }
  return null;
}