import { activeShifts, rangesOf, shiftForTime, type RestaurantSettings } from "./data";
import { serviceClock } from "./no-show";
import { fmt } from "./rotation";

export const UNDO_DURATION = 8_000;
export const WALKIN_DEFAULT_PEOPLE = 2;
export function walkinClock(now: Date, settings: RestaurantSettings) {
  const clock = serviceClock(now);
  const rounded = Math.round(clock.minutes / 5) * 5;
  const date = new Date(`${clock.date}T12:00:00Z`);
  if (rounded >= 1440) date.setUTCDate(date.getUTCDate() + 1);
  const time = fmt(rounded);
  const shift = shiftForTime(time, rangesOf(settings), activeShifts(settings)) ?? (rounded % 1440 >= 960 ? "sera" : "pranzo");
  return { date: date.toISOString().slice(0, 10), time, shift };
}
export function walkinValues(name: string, people: number, table: string) {
  return { _name: name.trim() || "Passante", _people: people, _table: table };
}