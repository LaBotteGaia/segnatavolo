import { describe, expect, it } from "vitest";
import { affluenceLevel, affluenceTip, bookableCapacity } from "@/lib/affluence";
import { DEFAULT_SETTINGS, normalizeSettings } from "@/lib/data";

const rooms = [
  { id: "a", open_days: [0, 1, 2, 3, 4, 5, 6], closed_periods: [], closed_shifts: [] as string[] },
  { id: "d", open_days: [0, 1, 2, 3, 4, 5, 6], closed_periods: [], closed_shifts: ["sera"] },
  { id: "w", open_days: [0, 1, 2, 3, 4, 5, 6], closed_periods: [{ from: "11-01", to: "03-31" }], closed_shifts: [] as string[] },
];
const tables = [{ room_id: "a", seats: 30 }, { room_id: "d", seats: 10 }, { room_id: "w", seats: 20 }];
const st = { ...DEFAULT_SETTINGS, reserve: 4 };

describe("margine di riserva", () => {
  it("default 4 posti", () => expect(normalizeSettings({}).reserve).toBe(4));
  it("sottrae la riserva dai posti delle sale aperte", () => expect(bookableCapacity("2026-06-10", "pranzo", rooms, tables, st)).toBe(56));
  it("esclude la sala chiusa per turno", () => expect(bookableCapacity("2026-06-10", "sera", rooms, tables, st)).toBe(46));
  it("esclude la sala chiusa per stagione", () => expect(bookableCapacity("2026-12-10", "pranzo", rooms, tables, st)).toBe(36));
  it("turno chiuso dal locale = null", () => expect(bookableCapacity("2026-06-10", "pranzo", rooms, tables, { ...st, holidays: [{ from: "2026-06-01", to: "2026-06-15" }] })).toBeNull());
});

describe("indicatori affluenza", () => {
  it("verde sotto 65%", () => expect(affluenceLevel(25, 40)).toBe("green"));
  it("giallo da 65% a 89%", () => { expect(affluenceLevel(26, 40)).toBe("yellow"); expect(affluenceLevel(35, 40)).toBe("yellow"); });
  it("rosso da 90%", () => expect(affluenceLevel(36, 40)).toBe("red"));
  it("grigio se chiuso", () => expect(affluenceLevel(0, null)).toBe("closed"));
  it("tooltip", () => expect(affluenceTip("pranzo", 28, 40)).toBe("Pranzo: 28/40 coperti - 70%"));
});
