import { describe, expect, it } from "vitest";
import { dayDots, dotLevel, roomCapacity, totalCapacities } from "@/lib/data";

describe("capienza", () => {
  const tables = [{ room_id: "a", seats: 4 }, { room_id: "a", seats: 6 }, { room_id: "b", seats: 2 }];
  it("usa la capienza impostata", () => expect(roomCapacity({ id: "a", capacity: 45 }, tables)).toBe(45));
  it("senza capienza somma i posti dei tavoli", () => expect(roomCapacity({ id: "a", capacity: null }, tables)).toBe(10));
  it("somma interne ed esterne separatamente", () =>
    expect(totalCapacities([{ id: "a", capacity: null, environment: "interno" }, { id: "b", capacity: 30, environment: "esterno" }], tables)).toEqual({ inside: 10, outside: 30 }));
});

describe("pallini", () => {
  it("bianco a 0", () => expect(dotLevel(0, 40)).toBe("white"));
  it("verde sotto 50%", () => expect(dotLevel(19, 40)).toBe("green"));
  it("giallo da 50% a 89%", () => { expect(dotLevel(20, 40)).toBe("yellow"); expect(dotLevel(35, 40)).toBe("yellow"); });
  it("rosso da 90% a 99%", () => expect(dotLevel(36, 40)).toBe("red"));
  it("nero al 100% o oltre", () => { expect(dotLevel(40, 40)).toBe("black"); expect(dotLevel(50, 40)).toBe("black"); });
  it("spento con capienza 0", () => expect(dotLevel(5, 0)).toBe("off"));
  it("usa il turno più occupato", () =>
    expect(dayDots([{ shift: "pranzo", people: 10, outside: false }, { shift: "sera", people: 30, outside: false }, { shift: "sera", people: 2, outside: true }], { inside: 40, outside: 0 })).toEqual({ inside: "yellow", outside: "off" }));
});

import { extraSeats, extrasText, toggleWall } from "@/lib/data";
describe("sponde e barelle", () => {
  it("sponda +1, barella +2", () => expect(extraSeats({ extra_sponde: 1, extra_barelle: 1, barella_seats: 2 })).toBe(3));
  it("barella da 1 posto", () => expect(extraSeats({ extra_sponde: 0, extra_barelle: 2, barella_seats: 1 })).toBe(2));
  it("etichetta", () => expect(extrasText({ extra_sponde: 1, extra_barelle: 0 })).toBe(" (+1 Sponda)"));
  it("parete toggle", () => expect(toggleWall(toggleWall([], "h:1:2"), "h:1:2")).toEqual([]));
});

describe("sale disattivate per turno", () => {
  const rooms = [
    { id: "a", capacity: 30, environment: "interno", closed_shifts: [] as string[] },
    { id: "d", capacity: 20, environment: "esterno", closed_shifts: ["sera"] },
  ];
  it("il dehors chiuso a cena non conta nella capienza della cena", () => {
    expect(totalCapacities(rooms, [], "sera")).toEqual({ inside: 30, outside: 0 });
    expect(totalCapacities(rooms, [], "pranzo")).toEqual({ inside: 30, outside: 20 });
  });
  it("i pallini usano la capienza del singolo turno", () => {
    const cap = (s: "colazione" | "pranzo" | "sera") => totalCapacities(rooms, [], s);
    expect(dayDots([{ shift: "pranzo", people: 19, outside: true }], cap).outside).toBe("red");
  });
});
