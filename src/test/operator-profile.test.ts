import { describe, expect, it } from "vitest";
import { passwordError } from "../lib/operator-profile";

describe("Cambio password operatore", () => {
  it("rifiuta sette caratteri e accetta otto", () => {
    expect(passwordError("abcdefg", "abcdefg")).not.toBeNull();
    expect(passwordError("abcdefgh", "abcdefgh")).toBeNull();
  });
  it("richiede una conferma identica", () => {
    expect(passwordError("abcdefgh", "abcdefgi")).not.toBeNull();
    expect(passwordError("abcdefgh", "abcdefgh")).toBeNull();
  });
});