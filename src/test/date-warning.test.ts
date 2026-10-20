import { describe, it, expect } from "vitest";
import { reservationDateWarning } from "@/lib/date-warning";
import { SHIFT_RANGES } from "@/lib/data";
const now = new Date("2026-10-20T18:00:00Z"); // 20:00 Europe/Rome
describe("presa visione date prenotazioni", () => {
  it("avvisa per un giorno passato", () => expect(reservationDateWarning("2026-10-19", "sera", "20:00", SHIFT_RANGES, now)?.kind).toBe("past"));
  it("avvisa per un orario già trascorso oggi", () => expect(reservationDateWarning("2026-10-20", "sera", "19:45", SHIFT_RANGES, now)?.kind).toBe("past"));
  it("avvisa solo oltre sei mesi, non al limite", () => {
    expect(reservationDateWarning("2027-04-20", "sera", "20:00", SHIFT_RANGES, now)).toBeNull();
    expect(reservationDateWarning("2027-04-21", "sera", "20:00", SHIFT_RANGES, now)?.kind).toBe("future");
  });
  it("una data o un orario diversi richiedono una nuova presa visione", () => {
    const a = reservationDateWarning("2026-10-19", "sera", "20:00", SHIFT_RANGES, now);
    const b = reservationDateWarning("2026-10-19", "sera", "20:15", SHIFT_RANGES, now);
    expect(a?.key).not.toEqual(b?.key);
  });
});