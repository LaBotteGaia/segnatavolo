import { describe, it, expect } from "vitest";
import { canJoin, wallBetween } from "@/lib/data";
const t = (id: string, x: number, y: number, no_join: string[] = []) => ({ id, x, y, room_id: "r", no_join });
describe("vincoli unione tavoli", () => {
  it("parete verticale tra tavoli sulla stessa riga blocca", () => {
    expect(wallBetween(t("a", 0, 0), t("b", 2, 0), ["v:2:0"])).toBe(true);
    expect(canJoin(t("a", 0, 0), t("b", 2, 0), () => ["v:2:0"])).toBe(false);
  });
  it("senza parete si possono unire", () => {
    expect(canJoin(t("a", 0, 0), t("b", 1, 0), () => [])).toBe(true);
  });
  it("parete orizzontale nella stessa colonna blocca", () => {
    expect(wallBetween(t("a", 1, 0), t("b", 1, 1), ["h:1:1"])).toBe(true);
  });
  it("esclusione manuale vale in entrambi i sensi", () => {
    expect(canJoin(t("a", 0, 0, ["b"]), t("b", 3, 3), () => [])).toBe(false);
    expect(canJoin(t("a", 0, 0), t("b", 3, 3, ["a"]), () => [])).toBe(false);
  });
});
