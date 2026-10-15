import { describe, it, expect } from "vitest";
import { validateReservation, timeSlots, shiftForTime, normalizeTime, commitTimeCheck } from "@/lib/data";

const ok = { name: "Rossi", people: 2, date: "2026-10-15", time: "12:30", shift: "pranzo" as const };

describe("validateReservation", () => {
  it("accepts a valid lunch booking", () => expect(validateReservation(ok)).toEqual({}));
  it("rejects blank name", () => expect(validateReservation({ ...ok, name: "   " }).name).toBeTruthy());
  it("rejects zero people", () => expect(validateReservation({ ...ok, people: 0 }).people).toBe("Inserisci almeno 1 persona"));
  it("rejects empty people", () => expect(validateReservation({ ...ok, people: "" }).people).toBeTruthy());
  it("rejects lunch time outside 12:00-14:30", () => expect(validateReservation({ ...ok, time: "14:45" }).time).toContain("12:00"));
  it("rejects dinner time outside 19:00-23:00", () => expect(validateReservation({ ...ok, shift: "sera", time: "18:45" }).time).toBeTruthy());
});

describe("slots", () => {
  it("lunch slots 12:00..14:30 every 15'", () => {
    const s = timeSlots("pranzo");
    expect(s[0]).toBe("12:00"); expect(s.at(-1)).toBe("14:30"); expect(s).toHaveLength(11);
  });
  it("dinner slots end at 23:00", () => expect(timeSlots("sera").at(-1)).toBe("23:00"));
  it("maps time to shift", () => { expect(shiftForTime("20:15")).toBe("sera"); expect(shiftForTime("16:00")).toBeNull(); });
});

describe("normalizeTime", () => {
  it("adds the colon when only digits are typed", () => {
    expect(normalizeTime("2100")).toBe("21:00");
    expect(normalizeTime("915")).toBe("09:15");
    expect(normalizeTime("12")).toBe("12:00");
  });
  it("pads single-digit hours and minutes", () => { expect(normalizeTime("9:5")).toBe("09:05"); });
  it("leaves unparseable text as typed", () => { expect(normalizeTime("ciao")).toBe("ciao"); expect(normalizeTime("")).toBe(""); });
});

describe("commitTimeCheck (typing a time straight into a row)", () => {
  it("saves a time inside the row's own window", () => expect(commitTimeCheck("12:45", "pranzo")).toEqual({ kind: "save", time: "12:45" }));
  it("saves digits-only input after adding the colon", () => expect(commitTimeCheck("1315", "pranzo")).toEqual({ kind: "save", time: "13:15" }));
  it("blocks an empty time and names the window", () => {
    const r = commitTimeCheck("", "sera");
    expect(r.kind).toBe("revert");
    expect(r.kind === "revert" && r.error).toContain("19:00");
  });
  it("blocks a time outside both windows", () => {
    const r = commitTimeCheck("16:30", "pranzo");
    expect(r.kind).toBe("revert");
    expect(r.kind === "revert" && r.error).toContain("14:30");
  });
  it("offers to move a lunch row when a dinner time is typed", () => {
    const r = commitTimeCheck("20:00", "pranzo");
    expect(r.kind).toBe("move");
    expect(r.kind === "move" && r.shift).toBe("sera");
    expect(r.kind === "move" && r.actionLabel).toBe("Sposta in Cena");
  });
  it("asks before moving a dinner row to a lunch time", () => {
    const r = commitTimeCheck("12:30", "sera");
    expect(r.kind).toBe("move");
    expect(r.kind === "move" && r.shift).toBe("pranzo");
    expect(r.kind === "move" && r.actionLabel).toBe("Sposta in Pranzo");
  });
});

import { closedShifts, firstName, zoneMismatch, DEFAULT_SETTINGS, timeSlots as ts2 } from "@/lib/data";
describe("nuove regole", () => {
  it("first word only", () => { expect(firstName("Mario Rossi")).toBe("Mario"); expect(firstName("  Rossi Mario ")).toBe("Rossi"); });
  const rooms = [{ id: "in", environment: "interno" }, { id: "out", environment: "esterno" }];
  const tables = [{ id: "t1", room_id: "in" }, { id: "e1", room_id: "out" }];
  it("Fuori + tavolo interno → avviso", () => expect(zoneMismatch({ outside: true, table_ids: ["t1"] }, tables, rooms)).toBe("interno-per-esterno"));
  it("Dentro + tavolo esterno → avviso", () => expect(zoneMismatch({ outside: false, table_ids: ["e1"] }, tables, rooms)).toBe("esterno-per-interno"));
  it("coerente → nessun avviso", () => expect(zoneMismatch({ outside: true, table_ids: ["e1"] }, tables, rooms)).toBeNull());
  it("Domenica chiuso a cena", () => {
    const st = { ...DEFAULT_SETTINGS, weekly: { "0": ["sera" as const] } };
    expect(closedShifts("2026-10-18", st)).toEqual(["sera"]);
    expect(closedShifts("2026-10-19", st)).toEqual([]);
  });
  it("ferie 10-25 agosto chiudono tutto", () => {
    const st = { ...DEFAULT_SETTINGS, holidays: [{ from: "2026-08-10", to: "2026-08-25" }] };
    expect(closedShifts("2026-08-15", st)).toHaveLength(3);
    expect(closedShifts("2026-08-26", st)).toEqual([]);
  });
  it("slot dinamici sulla fascia configurata", () => {
    const s = ts2("colazione", { ...{ pranzo: { from: "12:00", to: "14:30" }, sera: { from: "19:30", to: "23:00" } }, colazione: { from: "07:30", to: "10:30" } });
    expect(s[0]).toBe("07:30"); expect(s.at(-1)).toBe("10:30"); expect(s).toHaveLength(13);
  });
});

import { findCustomerByPhone, normPhone } from "@/lib/data";
describe("anti-omonimia", () => {
  const cs = [{ id: "1", name: "Mario Rossi", phone: "333 123-4567" }, { id: "2", name: "Mario Rossi", phone: "347 0000000" }] as never;
  it("normalizza spazi e trattini", () => expect(normPhone("333 123-4567")).toBe("3331234567"));
  it("trova il cliente dal telefono, non dal nome", () => expect(findCustomerByPhone(cs, "3470000000")?.id).toBe("2"));
});
