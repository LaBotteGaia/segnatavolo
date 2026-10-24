import { describe, expect, it } from "vitest";
import { chronologicalServiceRows } from "@/lib/service-sheet";

describe("ordinamento Foglio di Sala", () => {
  it("ordina per orario crescente anche tra sale diverse", () => {
    const rows = [{ id: "a", time: "20:30", room: "Sala" }, { id: "b", time: "19:15", room: "Dehors" }, { id: "c", time: "20:00", room: "Sala" }];
    expect(chronologicalServiceRows(rows).map((r) => r.id)).toEqual(["b", "c", "a"]);
    expect(rows.map((r) => r.id)).toEqual(["a", "b", "c"]);
  });
  it("a parità di orario usa la sequenza di inserimento", () => {
    expect(chronologicalServiceRows([
      { id: "seconda", time: "20:30", created_at: "2026-10-24T10:00:00Z" },
      { id: "prima", time: "20:30", created_at: "2026-10-24T09:00:00Z" },
    ]).map((r) => r.id)).toEqual(["prima", "seconda"]);
  });
  it("mantiene l'ordine stabile senza data di inserimento e mette gli orari mancanti in fondo", () => {
    expect(chronologicalServiceRows([{ id: "vuota", time: null }, { id: "a", time: "20:30" }, { id: "b", time: "20:30" }]).map((r) => r.id)).toEqual(["a", "b", "vuota"]);
  });
});