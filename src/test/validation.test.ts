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
