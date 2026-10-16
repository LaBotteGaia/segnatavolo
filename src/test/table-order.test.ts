import { describe, expect, it } from "vitest";
import { compareTableNames, compareTables } from "@/lib/data";

describe("ordine tavoli", () => {
  it("numeri in ordine numerico, poi lettere e nomi", () => {
    expect(["Privé", "10", "B", "2", "Dehors 1", "1", "A", "11"].sort(compareTableNames))
      .toEqual(["1", "2", "10", "11", "A", "B", "Dehors 1", "Privé"]);
  });
  it("prima l'ordine delle sale configurato", () => {
    const rooms = [{ id: "s2" }, { id: "s1" }];
    const t = [{ room_id: "s1", name: "1" }, { room_id: "s2", name: "B" }, { room_id: "s2", name: "3" }];
    expect(t.sort(compareTables(rooms)).map((x) => `${x.room_id}-${x.name}`)).toEqual(["s2-3", "s2-B", "s1-1"]);
  });
});
