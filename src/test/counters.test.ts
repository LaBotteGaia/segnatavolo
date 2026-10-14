import { describe, it, expect } from "vitest";
import { shiftCounters } from "@/lib/data";

describe("shiftCounters", () => {
  it("splits covers inside/outside and counts those yet to arrive", () => {
    const c = shiftCounters([
      { people: 4, outside: false, arrived: true },
      { people: 2, outside: true, arrived: false },
      { people: 3, outside: false, arrived: false },
    ]);
    expect(c).toEqual({ total: 9, inside: 7, outside: 2, pending: 5 });
  });
});
