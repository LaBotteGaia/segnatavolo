import { beforeEach, describe, expect, it } from "vitest";
import { assistId, clearAssist, getAssist, scopeAssist, setAssist } from "@/lib/assist";

const fakeQuery = () => {
  const calls: [string, string][] = [];
  return { calls, eq(col: string, val: string) { calls.push([col, val]); return this; } };
};

describe("modalità assistenza", () => {
  beforeEach(() => { sessionStorage.clear(); });

  it("senza assistenza attiva nessun filtro e nessun id", () => {
    expect(getAssist()).toBeNull();
    expect(assistId()).toBeNull();
    const q = fakeQuery();
    scopeAssist(q);
    expect(q.calls).toEqual([]);
  });

  it("con assistenza attiva le query sono filtrate sul ristorante scelto", () => {
    setAssist({ id: "r-1", name: "Trattoria Test" });
    expect(getAssist()).toEqual({ id: "r-1", name: "Trattoria Test" });
    const q = fakeQuery();
    scopeAssist(q);
    expect(q.calls).toEqual([["restaurant_id", "r-1"]]);
  });

  it("uscendo dall'assistenza il contesto torna pulito", () => {
    setAssist({ id: "r-1", name: "Trattoria Test" });
    clearAssist();
    expect(getAssist()).toBeNull();
    expect(assistId()).toBeNull();
  });

  it("dati corrotti in sessionStorage non bloccano l'app", () => {
    sessionStorage.setItem("segnatavolo_assist", "{non-json");
    expect(getAssist()).toBeNull();
    sessionStorage.setItem("segnatavolo_assist", JSON.stringify({ name: "Senza id" }));
    expect(getAssist()).toBeNull();
  });
});
