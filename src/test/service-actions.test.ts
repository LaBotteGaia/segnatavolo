import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "@/lib/data";
import { interval, tableState } from "@/lib/rotation";
import { UNDO_DURATION, WALKIN_DEFAULT_PEOPLE, walkinClock, walkinValues } from "@/lib/service-actions";

describe("servizio rapido", () => {
  it("concede 8 secondi per annullare", () => expect(UNDO_DURATION).toBe(8000));
  it("parte con 2 coperti", () => expect(WALKIN_DEFAULT_PEOPLE).toBe(2));
  it("arrotonda l’ora corrente ai 5 minuti più vicini in Italia", () => {
    expect(walkinClock(new Date("2026-10-21T10:03:00Z"), DEFAULT_SETTINGS)).toEqual({ date: "2026-10-21", time: "12:05", shift: "pranzo" });
  });
  it("riconosce automaticamente la cena", () => expect(walkinClock(new Date("2026-10-21T18:01:00Z"), DEFAULT_SETTINGS).shift).toBe("sera"));
  it("riconosce colazione quando configurata", () => expect(walkinClock(new Date("2026-10-21T06:01:00Z"), { ...DEFAULT_SETTINGS, shifts: { ...DEFAULT_SETTINGS.shifts, colazione: { ...DEFAULT_SETTINGS.shifts.colazione, enabled: true } } }).shift).toBe("colazione"));
  it("arrotondando mezzanotte cambia anche la data", () => expect(walkinClock(new Date("2026-10-21T21:58:00Z"), DEFAULT_SETTINGS)).toMatchObject({ date: "2026-10-22", time: "00:00" }));
  it("consente nome vuoto senza dati anagrafici", () => expect(walkinValues(" ", 2, "t1")).toEqual({ _name: "Passante", _people: 2, _table: "t1" }));
  it("rotazione passante 90 minuti più 15 di riassetto", () => expect(interval({ time: "12:05", duration_min: 90, buffer_min: 15 }, DEFAULT_SETTINGS)).toEqual({ start: 725, end: 815, free: 830 }));
  it("non offre un tavolo con conflitto entro i 105 minuti", () => expect(tableState("t1", { id: "walkin", time: "12:05", duration_min: 90, buffer_min: 15 }, [{ id: "future", name: "Prenotato", time: "13:30", table_ids: ["t1"] }], DEFAULT_SETTINGS).kind).toBe("busy"));
  it("ripristino mantiene il tavolo quando non c’è sovrapposizione", () => expect(tableState("t1", { id: "restore", time: "12:05", duration_min: 90, buffer_min: 15 }, [{ id: "other", name: "Altro", time: "13:50", table_ids: ["t1"] }], DEFAULT_SETTINGS).kind).not.toBe("busy"));
});