import { describe, expect, it } from "vitest";
import { maskPhone } from "@/lib/privacy";
describe("maschera telefono", () => {
  it("prime 3 e ultime 2 cifre", () => { expect(maskPhone("3401234512")).toBe("340 ••• ••12"); });
  it("con prefisso +39", () => { expect(maskPhone("+393481234589")).toBe("+39 348 ••• ••89"); });
});
