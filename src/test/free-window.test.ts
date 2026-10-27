import { describe, it, expect } from "vitest";
import { freeWindow, isScomodo } from "@/lib/live-floor";
const r = (time: string) => ({ id: time, name: "Rossi", people: 2, time, table_ids: ["t1"], arrived: false, notes: "" });
describe("freeWindow", () => {
  it("libero tutto il turno senza prenotazioni successive", () => expect(freeWindow("t1", [], 1190).kind).toBe("all"));
  it("19:50 con arrivo 21:15 → 1h 25m", () => expect(freeWindow("t1", [r("21:15")], 19 * 60 + 50).label).toBe("⏱️ Libero per 1h 25m (fino alle 21:15)"));
  it("sotto 45 minuti è imminente", () => expect(freeWindow("t1", [r("20:30")], 19 * 60 + 50)).toMatchObject({ kind: "imminent", minutes: 40 }));
});
describe("isScomodo", () => {
  const t = { seats: 4, coperti_comodi: 4, coperti_max: 6 };
  it("oltre i comodi ma entro il massimo", () => { expect(isScomodo(t, 5)).toBe(true); expect(isScomodo(t, 4)).toBe(false); expect(isScomodo(t, 7)).toBe(false); });
});
