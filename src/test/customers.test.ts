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
import { isLinkedReservation } from "@/lib/customers";
describe("collegamento prenotazioni", () => {
  const cu = { id: "c1", phone: "333 111", extra_phones: ["347-22"] };
  it("per id", () => { expect(isLinkedReservation(cu, { customer_id: "c1", phone: null })).toBe(true); });
  it("per telefono secondario normalizzato", () => { expect(isLinkedReservation(cu, { customer_id: null, phone: "34722" })).toBe(true); });
  it("altro cliente no", () => { expect(isLinkedReservation(cu, { customer_id: "x", phone: "999" })).toBe(false); });
});
