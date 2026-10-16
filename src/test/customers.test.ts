import { describe, expect, it } from "vitest";
import { matchesSearch, sortCustomers, initialOf } from "@/lib/customers";
const c = (id: string, first: string, last: string, phone = "", extra: string[] = []) =>
  ({ id, name: `${first} ${last}`, first_name: first, last_name: last, phone, extra_phones: extra, emails: [], notes: null }) as never;
describe("rubrica", () => {
  it("cerca anche nei telefoni secondari", () => { expect(matchesSearch(c("1", "Anna", "Rossi", "333", ["3471234"]), "347 12")).toBe(true); });
  it("ordina per cognome di default", () => {
    const l = sortCustomers([c("1", "Anna", "Verdi"), c("2", "Bruno", "Bianchi")], "last", new Map());
    expect(l.map((x: { id: string }) => x.id)).toEqual(["2", "1"]);
  });
  it("abituali in cima", () => {
    const l = sortCustomers([c("1", "A", "A"), c("2", "B", "B")], "visits", new Map([["2", { visits: 8, noShows: 0, last: null }]]));
    expect(l[0]).toMatchObject({ id: "2" });
  });
  it("lettera indice senza accenti", () => { expect(initialOf("Èrica")).toBe("E"); });
});
