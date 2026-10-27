import { describe, expect, it } from "vitest";
import { suggestTables } from "@/lib/allocation";
import { zoneCapacities, zoneTip } from "@/lib/affluence";
import { DEFAULT_SETTINGS } from "@/lib/data";

const room = { id: "r", environment: "interno", open_days: [0, 1, 2, 3, 4, 5, 6], closed_periods: [], closed_shifts: [], walls: [] };
const t = (id: string, seats: number, x: number, y: number, extra = {}) => ({ id, name: id, seats, x, y, room_id: "r", no_join: [] as string[], allow_extras: true, ...extra });
const base = { date: "2026-06-10", shift: "sera", time: "20:00", rooms: [room], others: [] as never[], cfg: { duration: 90, buffer: 15 }, wallsFor: () => [] };

describe("assegnazione intelligente", () => {
  it('posti scomodi singoli solo se consentiti, dopo le soluzioni comode',()=>{const tables=[t('A',2,0,0,{coperti_comodi:2,coperti_max:3,posti_scomodi_solo_in_unione:false})];expect(suggestTables({...base,people:3,tables})?.ids).toEqual(['A']);expect(suggestTables({...base,people:3,tables:[t('A',2,0,0,{coperti_comodi:2,coperti_max:3,posti_scomodi_solo_in_unione:true})]})).toBeNull();});
  it('non unisce un tavolo isola',()=>expect(suggestTables({...base,people:8,tables:[t('A',4,0,0,{accoppiabile:false}),t('B',4,1,0)]})).toBeNull());
  it('isola resta assegnabile singolarmente',()=>expect(suggestTables({...base,people:2,tables:[t('A',2,0,0,{accoppiabile:false})]})?.ids).toEqual(['A']));
  it('seduta lunga preferisce tavolo dedicato',()=>expect(suggestTables({...base,time:'21:00',people:2,rules:{longStay:{enabled:true,from:'21:00'},protectModular:false},tables:[t('A',2,0,0),t('B',4,1,0,{adatto_seduta_lunga:true})]})?.ids).toEqual(['B']));
  it('coppia preserva componibili se isola sufficiente libera',()=>expect(suggestTables({...base,people:2,rules:{longStay:{enabled:false,from:'21:00'},protectModular:true},tables:[t('A',2,0,0),t('B',4,1,0,{accoppiabile:false})]})?.ids).toEqual(['B']));
  it("preferisce il tavolo da 2 per 2 persone", () => expect(suggestTables({ ...base, people: 2, tables: [t("T4", 4, 0, 0), t("T2", 2, 3, 3)] })?.ids).toEqual(["T2"]));
  it("3 persone: tavolo da 4 senza sponde", () => {
    const s = suggestTables({ ...base, people: 3, tables: [t("T4", 4, 0, 0), t("T2", 2, 3, 3)] });
    expect(s?.ids).toEqual(["T4"]); expect(s?.extras.extra_sponde).toBe(0);
  });
  it("8 persone: unisce i due tavoli vicini", () => expect(suggestTables({ ...base, people: 8, tables: [t("A", 4, 0, 0), t("B", 4, 1, 0), t("C", 4, 5, 4)] })?.ids).toEqual(["A", "B"]));
  it("fino a 8 pax non usa prolunghe anche senza alternativa", () => expect(suggestTables({ ...base, people: 8, tables: [t("A", 7, 0, 0)] })).toBeNull());
  it("oltre 8 preferisce tavoli sufficienti senza prolunghe", () => {
    const s = suggestTables({ ...base, people: 9, tables: [t("A", 8, 0, 0),t("B", 4, 1, 0)] });
    expect(s?.ids).toEqual(["A","B"]); expect(s?.extras.extra_sponde).toBe(0);
  });
  it("anche oltre 8 sceglie il singolo comodo prima dell’unione", () => expect(suggestTables({ ...base, people: 9, tables: [t('A',5,0,0),t('B',4,1,0),t('Grande',12,5,5)] })?.ids).toEqual(['Grande']));
  it("9 pax può aggiungere una sola sponda a un tavolo da 8", () => expect(suggestTables({ ...base, people: 9, tables: [t("A", 8, 0, 0)] })?.extras.extra_sponde).toBe(1));
  it("10 pax non può aggiungere due sponde a un solo tavolo", () => expect(suggestTables({ ...base, people: 10, tables: [t("A", 8, 0, 0)] })).toBeNull());
  it("10 pax usa una sponda per ciascuno dei due tavoli da 4", () => expect(suggestTables({ ...base, people: 10, tables: [t("A",4,0,0),t("B",4,1,0)] })?.extras.extra_sponde).toBe(2));
  it("le prolunghe contano solo sui tavoli abilitati", () => expect(suggestTables({ ...base, people: 10, tables: [t("A",4,0,0,{allow_extras:false}),t("B",4,1,0)] })).toBeNull());
  it("esclude unioni vietate", () => expect(suggestTables({ ...base, people: 8, tables: [t("A", 4, 0, 0, { no_join: ["B"] }), t("B", 4, 1, 0)] })).toBeNull());
  it("tavolo libero se l'altra prenotazione non si sovrappone (doppio turno)", () => {
    const others = [{ id: "x", name: "X", table_ids: ["T2"], time: "21:45" }];
    expect(suggestTables({ ...base, time: "19:30", others, people: 2, tables: [t("T2", 2, 0, 0)] })?.ids).toEqual(["T2"]);
    expect(suggestTables({ ...base, time: "21:00", others, people: 2, tables: [t("T2", 2, 0, 0)] })).toBeNull();
  });
});

describe("affluenza interno/esterno", () => {
  const rooms = [{ ...room, id: "i" }, { ...room, id: "e", environment: "esterno", closed_periods: [{ from: "11-01", to: "03-31" }] }];
  const tables = [{ room_id: "i", seats: 49 }, { room_id: "e", seats: 20 }];
  it("riserva sulle interne", () => expect(zoneCapacities("2026-06-10", "sera", rooms, tables, { ...DEFAULT_SETTINGS, reserve: 4 })).toEqual({ inside: 45, outside: 20 }));
  it("esterne chiuse = null", () => expect(zoneCapacities("2026-12-10", "sera", rooms, tables, { ...DEFAULT_SETTINGS, reserve: 4 }).outside).toBeNull());
  it("tooltip", () => expect(zoneTip(32, 45, 0, null)).toBe("Interno: 32/45 coperti (71%) | Esterno: Chiuso"));
});
