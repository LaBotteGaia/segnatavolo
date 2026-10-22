import { describe, it, expect } from "vitest";
import { shiftCounters } from "@/lib/data";

describe("shiftCounters", () => {
  it("conta solo le richieste confermate e le prenotazioni preesistenti", () => {
    expect(shiftCounters([
      { people: 6, outside: false, arrived: false, status: "pending" },
      { people: 5, outside: true, arrived: false, status: "rejected" },
      { people: 3, outside: false, arrived: false, status: "confirmed" },
      { people: 2, outside: true, arrived: true },
    ])).toEqual({ total: 5, inside: 3, outside: 2, pending: 3 });
  });
  it("esclude un No-Show manuale dai coperti da servire", () => {
    expect(shiftCounters([{ people: 4, outside: false, arrived: false, no_show: true }])).toEqual({ total: 0, inside: 0, outside: 0, pending: 0 });
  });
  it("splits covers inside/outside and counts those yet to arrive", () => {
    const c = shiftCounters([
      { people: 4, outside: false, arrived: true },
      { people: 2, outside: true, arrived: false },
      { people: 3, outside: false, arrived: false },
    ]);
    expect(c).toEqual({ total: 9, inside: 7, outside: 2, pending: 5 });
  });
});
