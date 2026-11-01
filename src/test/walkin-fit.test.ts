import { describe, expect, it } from "vitest";
import { walkinFit } from "@/lib/live-floor";

const t = { seats: 4, coperti_comodi: 4, coperti_max: 6 };
describe("regola unica di capienza per accomodare al volo", () => {
  it("ammette un tavolo più grande dei commensali", () => expect(walkinFit(t, 2)).toBe("ok"));
  it("chiede conferma oltre i posti comodi", () => expect(walkinFit(t, 5)).toBe("scomodo"));
  it("blocca oltre il massimo", () => expect(walkinFit(t, 7)).toBe("too_small"));
  it("massimo uguale ai comodi", () => expect(walkinFit({ seats: 4, coperti_comodi: 4, coperti_max: 4 }, 5)).toBe("too_small"));
});
