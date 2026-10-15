import { describe, expect, it } from "vitest";
import { SHIFT_RANGES } from "@/lib/data";
import { isNoShow, reliabilityStats, type HistoryRow } from "@/lib/no-show";

const row = (patch: Partial<HistoryRow> = {}): HistoryRow => ({ id: "one", phone: "333 123-4567", date: "2026-10-15", shift: "sera", time: "20:00", arrived: false, ...patch });
describe("No-Show", () => {
  it("non segna prima della fine turno ma segna dopo, anche senza riaprire il giorno", () => {
    expect(isNoShow(row(), SHIFT_RANGES, new Date("2026-10-15T20:59:00Z"))).toBe(false);
    expect(isNoShow(row(), SHIFT_RANGES, new Date("2026-10-15T21:01:00Z"))).toBe(true);
  });
  it("arrivato non è mai No-Show", () => {
    expect(isNoShow(row({ arrived: true, no_show: true }), SHIFT_RANGES, new Date("2026-10-16T12:00:00Z"))).toBe(false);
  });
  it("manuale conta prima della fine servizio", () => {
    expect(isNoShow(row({ no_show: true }), SHIFT_RANGES, new Date("2026-10-15T17:00:00Z"))).toBe(true);
  });
  it("telefono normalizzato: 3 visite, 1 No-Show e ultima mancata presentazione", () => {
    const rows = [row(), ...["2026-10-10", "2026-10-11", "2026-10-12"].map((date) => row({ id: date, date, arrived: true })), row({ id: "other", phone: "99999" })];
    expect(reliabilityStats(rows, "3331234567", SHIFT_RANGES, new Date("2026-10-16T12:00:00Z"))).toEqual({ count: 3, noShows: 1, last: "2026-10-15", lastNoShow: true });
  });
  it("prenotazione cancellata non conta e i telefoni omonimi restano separati", () => {
    expect(reliabilityStats([], "3331234567", SHIFT_RANGES, new Date())).toEqual({ count: 0, noShows: 0, last: null, lastNoShow: false });
    expect(reliabilityStats([row()], "99999", SHIFT_RANGES, new Date("2026-10-16T12:00:00Z")).noShows).toBe(0);
  });
  it("turno oltre mezzanotte termina il giorno dopo", () => {
    const ranges = { ...SHIFT_RANGES, sera: { from: "19:00", to: "01:00" } };
    expect(isNoShow(row(), ranges, new Date("2026-10-15T22:30:00Z"))).toBe(false);
    expect(isNoShow(row(), ranges, new Date("2026-10-15T23:01:00Z"))).toBe(true);
  });
});