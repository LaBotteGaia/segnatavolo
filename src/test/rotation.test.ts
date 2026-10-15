import { describe, it, expect } from "vitest";
import { tableState, isRoomClosed, rotationNote, shiftAvailability, interval } from "@/lib/rotation";
import { SHIFT_RANGES } from "@/lib/data";

const cfg = { duration: 90, buffer: 15 };
const first = { id: "a", name: "Rossi", time: "20:00", table_ids: ["t4"] };

describe("rotazione tavoli", () => {
  it("20:00 occupa fino 21:30, riassegnabile dalle 21:45", () => {
    expect(interval(first, cfg)).toEqual({ start: 1200, end: 1290, free: 1305 });
  });
  it("tavolo verde per le 21:45", () => expect(tableState("t4", { id: "n", time: "21:45" }, [first], cfg).kind).toBe("free"));
  it("rosso alle 21:30 con 'occupato fino alle 21:45'", () =>
    expect(tableState("t4", { id: "n", time: "21:30" }, [first], cfg)).toMatchObject({ kind: "busy", until: "21:45" }));
  it("libero ma con prenotazione dopo: disponibile fino a inizio - buffer", () =>
    expect(tableState("t4", { id: "n", time: "18:00" }, [first], cfg)).toEqual({ kind: "limited", until: "19:45" }));
  it("tutta la sera blocca la rotazione", () =>
    expect(tableState("t4", { id: "n", time: "22:30" }, [{ ...first, duration_min: -1 }], cfg).kind).toBe("busy"));
  it("buffer 0 libera subito a fine durata", () =>
    expect(tableState("t4", { id: "n", time: "21:30" }, [{ ...first, buffer_min: 0 }], cfg).kind).toBe("free"));
  it("etichette agenda", () => {
    const second = { id: "b", name: "Bianchi", time: "21:45", table_ids: ["t4"] };
    expect(rotationNote(first, [first, second], cfg)).toBe(" (fino 21:30)");
    expect(rotationNote(second, [first, second], cfg)).toBe(" (dalle 21:45)");
  });
});

describe("sale stagionali", () => {
  const dehors = { open_days: [5, 6, 0], closed_periods: [{ from: "11-01", to: "03-31" }] };
  it("chiusa d'inverno (scavalca l'anno)", () => { expect(isRoomClosed(dehors, "2026-12-12")).toBe(true); expect(isRoomClosed(dehors, "2027-03-06")).toBe(true); });
  it("aperta solo Ven-Sab-Dom", () => { expect(isRoomClosed(dehors, "2026-06-12")).toBe(false); expect(isRoomClosed(dehors, "2026-06-10")).toBe(true); });
});

describe("riepilogo disponibilità", () => {
  const T = (id: string) => ({ id, name: id, seats: 4 }) as never;
  it("categorie", () => {
    const rows = [first, { id: "c", name: "X", time: "21:30", table_ids: ["t2"] }, { id: "d", name: "Y", time: "19:00", table_ids: ["t3"], duration_min: -1 }];
    const a = shiftAvailability([T("t1"), T("t2"), T("t3"), T("t4")], rows, "sera", SHIFT_RANGES, cfg);
    expect(a.free.map((t) => t.id)).toEqual(["t1"]);
    expect(a.first.find((x) => x.t.id === "t2")?.until).toBe("21:15");
    expect(a.second.find((x) => x.t.id === "t4")?.from).toBe("21:45");
    expect(a.full.map((t) => t.id)).toEqual(["t3"]);
  });
});
