import { normPhone, type Ranges, type Reservation } from "./data";

export type HistoryRow = Pick<Reservation, "id" | "phone" | "date" | "shift" | "time" | "arrived"> & { no_show?: boolean };
export type Reliability = { count: number; noShows: number; last: string | null; lastNoShow: boolean };

/** Restaurant service dates and deadlines use the restaurant's Italian timezone. */
export function serviceClock(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const get = (key: string) => parts.find((p) => p.type === key)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

export function serviceEnded(r: HistoryRow, ranges: Ranges, now: Date): boolean {
  const clock = serviceClock(now);
  const range = ranges[r.shift as keyof Ranges];
  if (!range) return r.date < clock.date;
  const minutes = (t: string) => { const [h = 0, m = 0] = t.split(":").map(Number); return h * 60 + m; };
  const end = minutes(range.to);
  if (end < minutes(range.from)) {
    const next = new Date(`${r.date}T12:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    const endDate = next.toISOString().slice(0, 10);
    return endDate < clock.date || (endDate === clock.date && clock.minutes > end);
  }
  return r.date < clock.date || (r.date === clock.date && clock.minutes > end);
}

export function isNoShow(r: HistoryRow, ranges: Ranges, now: Date): boolean {
  return !r.arrived && (!!r.no_show || serviceEnded(r, ranges, now));
}

export function reliabilityStats(rows: HistoryRow[], phone: string | null | undefined, ranges: Ranges, now: Date, excludeId?: string): Reliability {
  const ph = normPhone(phone);
  const past = ph ? rows.filter((r) => r.id !== excludeId && normPhone(r.phone) === ph && (r.no_show || serviceEnded(r, ranges, now)))
    .sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time)) : [];
  const last = past[0];
  return { count: past.filter((r) => r.arrived).length, noShows: past.filter((r) => isNoShow(r, ranges, now)).length, last: last?.date ?? null, lastNoShow: !!last && isNoShow(last, ranges, now) };
}