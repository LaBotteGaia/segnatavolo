import { describe, it, expect } from "vitest";
import { freeWindow, isScomodo, limitedStay } from "@/lib/live-floor";
const r = (time: string) => ({ id: time, name: "Rossi", people: 2, time, table_ids: ["t1"], arrived: false, notes: "" });
describe("freeWindow", () => {
  it("libero tutto il turno senza prenotazioni successive", () => expect(freeWindow("t1", [], 1190).kind).toBe("all"));
  it("19:50, arrivo 21:15, riassetto 10 → fino alle 21:05", () => expect(freeWindow("t1", [r("21:15")], 19 * 60 + 50, 10).label).toBe("⏱️ Libero fino alle 21:05 (1h 15m disponibili)"));
  it("riassetto 0 → fino all'arrivo", () => expect(freeWindow("t1", [r("21:15")], 19 * 60 + 50, 0).label).toBe("⏱️ Libero fino alle 21:15 (1h 25m disponibili)"));
  it("sotto 45 minuti effettivi è imminente", () => expect(freeWindow("t1", [r("20:40")], 19 * 60 + 50, 10)).toMatchObject({ kind: "imminent", minutes: 40 }));
  it("uscita massima per l'accomoda al volo = arrivo − riassetto", () => expect(limitedStay(21 * 60 + 15, 19 * 60 + 50, { duration: 90, buffer: 10 })?.until).toBe("21:05"));
});
describe("isScomodo", () => {
  const t = { seats: 4, coperti_comodi: 4, coperti_max: 6 };
  it("oltre i comodi ma entro il massimo", () => { expect(isScomodo(t, 5)).toBe(true); expect(isScomodo(t, 4)).toBe(false); expect(isScomodo(t, 7)).toBe(false); });
});
