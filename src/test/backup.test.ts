import { describe, it, expect } from "vitest";
import { backupFileName, validateBackup } from "@/lib/backup";

describe("backup ristorante", () => {
  it("nome file nel formato backup-nome-YYYY-MM-DD-HHmm.json", () => {
    expect(backupFileName("Osteria La BotteGaia", new Date(2026, 9, 22, 9, 5))).toBe("backup-osteria-la-bottegaia-2026-10-22-0905.json");
  });
  it("rifiuta un file senza sale, tavoli o prenotazioni", () => {
    expect(validateBackup({ rooms: [], tables: [] }).ok).toBe(false);
    expect(validateBackup("x").ok).toBe(false);
  });
  it("riassume un backup valido", () => {
    const r = validateBackup({ meta: { exported_at: "2026-10-22T07:00:00Z" }, restaurant: { name: "A" }, rooms: [{}], tables: [{}, {}], reservations: [{}, {}, {}] });
    expect(r.ok && r.summary).toMatchObject({ rooms: 1, tables: 2, reservations: 3, restaurantName: "A" });
  });
});
