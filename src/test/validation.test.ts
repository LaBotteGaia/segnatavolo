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
