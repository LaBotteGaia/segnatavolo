import { describe, expect, it } from "vitest";
import { arrivalsLists, liveCounters, liveTableState, movedTableIds, seatedSinceLabel, swappedTableIds } from "@/lib/live-floor";

const cfg = { duration: 90, buffer: 15 };
const res = (id: string, time: string, table: string, arrived: boolean, extra: Record<string, unknown> = {}) =>
  ({ id, name: `Comitiva ${id}`, people: 4, time, table_ids: [table], arrived, ...extra }) as never;

describe("stato live dei tavoli", () => {
  it("tavolo libero senza prenotazioni", () => {
    expect(liveTableState("t1", [], 20 * 60, cfg)).toEqual({ kind: "free" });
  });
  it("occupato: arrivato e dentro l'intervallo, con minuti di seduta e fine prevista", () => {
    const st = liveTableState("t1", [res("a", "20:00", "t1", true)], 20 * 60 + 45, cfg);
    expect(st).toMatchObject({ kind: "seated", sinceMin: 45, until: "21:45" });
  });
  it("libero dopo fine turno più riallestimento anche se segnato arrivato", () => {
    expect(liveTableState("t1", [res("a", "20:00", "t1", true)], 21 * 60 + 45, cfg).kind).toBe("free");
  });
  it("in arrivo a breve: prenotazione entro 30 minuti non ancora arrivata", () => {
    const st = liveTableState("t1", [res("a", "20:20", "t1", false)], 20 * 60, cfg);
    expect(st).toMatchObject({ kind: "incoming", at: "20:20" });
  });
  it("in ritardo di pochi minuti resta in arrivo, oltre la tolleranza torna libero", () => {
    expect(liveTableState("t1", [res("a", "20:00", "t1", false)], 20 * 60 + 10, cfg).kind).toBe("incoming");
    expect(liveTableState("t1", [res("a", "20:00", "t1", false)], 20 * 60 + 20, cfg).kind).toBe("free");
  });
  it("il seduto prevale sull'in arrivo sullo stesso tavolo", () => {
    const rows = [res("a", "19:30", "t1", true), res("b", "20:10", "t1", false)];
    expect(liveTableState("t1", rows, 20 * 60, cfg).kind).toBe("seated");
  });
  it("i no-show non occupano il tavolo", () => {
    expect(liveTableState("t1", [res("a", "20:00", "t1", true, { no_show: true })], 20 * 60 + 10, cfg).kind).toBe("free");
  });
  it("tutta la sera: occupato fino a fine serata", () => {
    const st = liveTableState("t1", [res("a", "20:00", "t1", true, { duration_min: -1 })], 23 * 60, cfg);
    expect(st).toMatchObject({ kind: "seated", until: "fine serata" });
  });
});

describe("contatori live", () => {
  it("conta coperti seduti, tavoli liberi e in arrivo", () => {
    const tables = [{ id: "t1" }, { id: "t2" }, { id: "t3" }] as never[];
    const rows = [res("a", "19:30", "t1", true), res("b", "20:20", "t2", false)];
    expect(liveCounters(tables, rows, 20 * 60, cfg)).toEqual({ seatedCovers: 4, freeTables: 1, incomingTables: 1 });
  });
});

describe("sposta e scambia", () => {
  it("lo spostamento sostituisce solo il tavolo toccato e preserva le unioni", () => {
    expect(movedTableIds(["t1", "t2"], "t1", "t9")).toEqual(["t9", "t2"]);
  });
  it("lo scambio inverte i due tavoli tra le comitive", () => {
    expect(swappedTableIds(["t4"], ["t9", "t10"], "t4", "t9")).toEqual({ a: ["t9"], b: ["t4", "t10"] });
  });
});

describe("colonna arrivi", () => {
  it("separa in arrivo e seduti, ordinati per orario, senza no-show", () => {
    const rows = [res("a", "20:30", "t1", false), res("b", "19:45", "t2", true), res("c", "20:00", "t3", false, { no_show: true }), res("d", "20:10", "t4", true)];
    const { incoming, seated } = arrivalsLists(rows);
    expect(incoming.map((r) => r.id)).toEqual(["a"]);
    expect(seated.map((r) => r.id)).toEqual(["b", "d"]);
  });
});

describe("etichetta seduta", () => {
  it("minuti sotto l'ora e ore+minuti sopra", () => {
    expect(seatedSinceLabel(45)).toBe("Seduti da 45 min");
    expect(seatedSinceLabel(80)).toBe("Seduti da 1h 20m");
  });
});

import { limitedStay, maxStayBadge, nextBookingOn } from "@/lib/live-floor";
describe("permanenza massima vincolata", () => {
  const cfg = { duration: 90, buffer: 15 };
  it("alle 19:45 con prenotazione alle 21:15 propone uscita alle 21:00 (75 min)", () => {
    expect(limitedStay(21 * 60 + 15, 19 * 60 + 45, cfg)).toEqual({ untilMin: 21 * 60, until: "21:00", minutes: 75, allowed: true });
  });
  it("nessun vincolo se la seduta standard ci sta", () => {
    expect(limitedStay(22 * 60, 19 * 60 + 45, cfg)).toBeNull();
  });
  it("rifiuta con meno di 15 minuti disponibili", () => {
    expect(limitedStay(21 * 60, 20 * 60 + 35, cfg)?.allowed).toBe(false);
  });
  it("trova la prossima prenotazione sul tavolo", () => {
    const rows = [{ id: "a", name: "Rossi", people: 2, time: "21:15", table_ids: ["T1"], arrived: false, notes: "" }];
    expect(nextBookingOn(["T1"], rows, 19 * 60 + 45)?.name).toBe("Rossi");
    expect(nextBookingOn(["T2"], rows, 19 * 60 + 45)).toBeNull();
  });
  it("badge urgente sotto i 15 minuti", () => {
    expect(maxStayBadge("21:00", 20 * 60 + 50)).toEqual({ label: "⏳ Max fino alle 21:00 (10 min rimanenti)", urgent: true });
    expect(maxStayBadge("21:00", 20 * 60)?.urgent).toBe(false);
  });
});
