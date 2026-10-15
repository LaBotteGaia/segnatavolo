import { describe, expect, it } from "vitest";
import { searchFilter, toCsv, validSeats, validTableName, visitStats } from "@/lib/extras";

describe("fedeltà", () => {
  it("conta solo visite passate e trova l'ultima", () => {
    expect(visitStats(["2026-09-14", "2026-08-01", "2026-10-20"], "2026-10-15")).toEqual({ count: 2, last: "2026-09-14" });
  });
  it("nessuna visita passata", () => {
    expect(visitStats(["2026-10-15"], "2026-10-15")).toEqual({ count: 0, last: null });
  });
});

describe("campi tavolo", () => {
  it("nome vuoto o spazi non valido", () => { expect(validTableName("  ")).toBe(false); expect(validTableName("T1")).toBe(true); });
  it("coperti interi > 0", () => {
    expect(validSeats("")).toBe(false); expect(validSeats("0")).toBe(false); expect(validSeats("-2")).toBe(false);
    expect(validSeats("2.5")).toBe(false); expect(validSeats("4")).toBe(true);
  });
});

describe("ricerca", () => {
  it("serve almeno 3 caratteri", () => { expect(searchFilter("ro")).toBeNull(); expect(searchFilter("ros")).not.toBeNull(); });
});

describe("csv", () => {
  it("usa ; ed escape delle virgolette", () => {
    expect(toCsv([{ a: 'x;"y"', b: 2 }], [{ key: "a", label: "A" }, { key: "b", label: "B" }])).toBe('A;B\r\n"x;""y""";2');
  });
});
