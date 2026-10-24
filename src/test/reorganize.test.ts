import { describe, expect, it } from "vitest";
import { reorganizeService, type ReorgReservation, type ReorgTable } from "@/lib/reorganize";

const room = { id: "r", environment: "interno", open_days: [0, 1, 2, 3, 4, 5, 6], closed_periods: [], closed_shifts: [] };
const t = (id: string, seats: number, x: number, y: number, extra: Partial<ReorgTable> = {}): ReorgTable => ({
  id, name: id, seats, x, y, room_id: "r", no_join: [] as string[], allow_extras: true,
  coperti_comodi: seats, coperti_max: seats, posti_scomodi_solo_in_unione: true, ordine_riempimento: 99, ...extra,
});
const res = (id: string, people: number, table_ids: string[] = [], extra: Partial<ReorgReservation> = {}): ReorgReservation => ({
  id, name: id, people, time: "20:00", table_ids, outside: false, ...extra,
});
const base = { date: "2026-06-10", shift: "sera", rooms: [room], cfg: { duration: 90, buffer: 15 }, wallsFor: () => [] as string[] };

describe("riorganizzazione automatica della sala", () => {
  it('non unisce isole',()=>{const out=reorganizeService({...base,reservations:[res('R',8)],tables:[t('A',4,0,0,{accoppiabile:false}),t('B',4,1,0)]});expect(out.unplaced.map(r=>r.id)).toEqual(['R']);});
  it('seduta lunga e piccoli gruppi rispettano le priorità',()=>{const out=reorganizeService({...base,rules:{longStay:{enabled:true,from:'21:00'},protectModular:true},reservations:[res('R',2,[],{time:'21:00'})],tables:[t('A',2,0,0),t('B',4,1,0,{accoppiabile:false,adatto_seduta_lunga:true})]});expect(out.assignments.get('R')?.ids).toEqual(['B']);});
  it("sposta una comitiva sul tavolo comodo più adatto", () => {
    const out = reorganizeService({ ...base, reservations: [res("A", 2, ["T4"])], tables: [t("T4", 4, 0, 0), t("T2", 2, 3, 3)] });
    expect(out.moves).toHaveLength(1);
    expect(out.assignments.get("A")?.ids).toEqual(["T2"]);
  });
  it("lascia invariata una prenotazione già ben piazzata", () => {
    const out = reorganizeService({ ...base, reservations: [res("A", 2, ["T2"])], tables: [t("T4", 4, 0, 0), t("T2", 2, 3, 3)] });
    expect(out.moves).toHaveLength(0);
    expect(out.unchanged).toBe(1);
  });
  it("le prenotazioni col lucchetto non si spostano e tengono occupato il tavolo", () => {
    const out = reorganizeService({
      ...base,
      reservations: [res("B", 2, ["T2"], { tavolo_bloccato: true }), res("A", 2, [])],
      tables: [t("T4", 4, 0, 0), t("T2", 2, 3, 3)],
    });
    expect(out.locked).toBe(1);
    expect(out.assignments.get("B")).toBeUndefined();
    expect(out.assignments.get("A")?.ids).toEqual(["T4"]); // T2 resta occupato dal bloccato
  });
  it("riempie prima i tavoli con ordine di riempimento più basso", () => {
    const out = reorganizeService({
      ...base,
      reservations: [res("A", 2, []), res("B", 2, [])],
      tables: [t("T1", 2, 0, 0, { ordine_riempimento: 5 }), t("T2", 2, 1, 0, { ordine_riempimento: 1 })],
    });
    expect(out.assignments.get("A")?.ids).toEqual(["T2"]);
    expect(out.assignments.get("B")?.ids).toEqual(["T1"]);
  });
  it("piazza prima le comitive più numerose", () => {
    const out = reorganizeService({
      ...base,
      reservations: [res("Piccola", 2, []), res("Grande", 6, [])],
      tables: [t("T6", 6, 0, 0), t("T2", 2, 3, 3)],
    });
    expect(out.assignments.get("Grande")?.ids).toEqual(["T6"]);
    expect(out.assignments.get("Piccola")?.ids).toEqual(["T2"]);
  });
  it("unisce tavoli contigui sommando i coperti comodi", () => {
    const out = reorganizeService({ ...base, reservations: [res("A", 8, [])], tables: [t("A", 4, 0, 0), t("B", 4, 1, 0), t("C", 4, 5, 5)] });
    expect(out.assignments.get("A")?.ids).toEqual(["A", "B"]);
  });
  it("da solo non supera i coperti comodi se i posti scomodi sono solo in unione", () => {
    const out = reorganizeService({ ...base, reservations: [res("A", 5, [])], tables: [t("T", 4, 0, 0, { coperti_max: 6 })] });
    expect(out.unplaced.map((r) => r.id)).toEqual(["A"]);
  });
  it("usa i posti scomodi sul singolo solo se esplicitamente consentiti", () => {
    const out = reorganizeService({ ...base, reservations: [res("A", 5, [])], tables: [t("T", 4, 0, 0, { coperti_max: 6, posti_scomodi_solo_in_unione: false })] });
    expect(out.assignments.get("A")?.ids).toEqual(["T"]);
  });
  it("in unione la capienza estesa rende accessibili i posti di raccordo", () => {
    const out = reorganizeService({
      ...base,
      reservations: [res("A", 10, [])],
      tables: [t("A", 4, 0, 0, { coperti_max: 5 }), t("B", 4, 1, 0, { coperti_max: 5 })],
    });
    expect(out.assignments.get("A")?.ids).toEqual(["A", "B"]);
  });
  it("oltre 8 pax aggiunge al massimo una prolunga per tavolo dell'unione", () => {
    const out = reorganizeService({ ...base, reservations: [res("A", 10, [])], tables: [t("A", 4, 0, 0), t("B", 4, 1, 0)] });
    expect(out.assignments.get("A")?.extras.extra_sponde).toBe(2);
    const negato = reorganizeService({ ...base, reservations: [res("A", 11, [])], tables: [t("A", 4, 0, 0), t("B", 4, 1, 0)] });
    expect(negato.unplaced.map((r) => r.id)).toEqual(["A"]);
  });
  it("non assegna lo stesso tavolo a due prenotazioni sovrapposte", () => {
    const out = reorganizeService({
      ...base,
      reservations: [res("A", 2, []), res("B", 2, [], { time: "20:30" })],
      tables: [t("T2", 2, 0, 0), t("T3", 2, 3, 3)],
    });
    expect(out.assignments.get("A")?.ids).not.toEqual(out.assignments.get("B")?.ids);
  });
  it("riusa lo stesso tavolo per orari non sovrapposti (doppio turno)", () => {
    const out = reorganizeService({
      ...base,
      reservations: [res("A", 2, [], { time: "19:00" }), res("B", 2, [], { time: "21:30" })],
      tables: [t("T2", 2, 0, 0)],
    });
    expect(out.unplaced).toHaveLength(0);
    expect(out.assignments.get("B")?.ids).toEqual(["T2"]);
  });
  it("rispetta la zona richiesta (fuori)", () => {
    const rooms = [room, { ...room, id: "e", environment: "esterno" }];
    const out = reorganizeService({
      ...base, rooms,
      reservations: [res("A", 2, [], { outside: true })],
      tables: [t("Ti", 2, 0, 0), t("Te", 2, 0, 0, { room_id: "e" })],
    });
    expect(out.assignments.get("A")?.ids).toEqual(["Te"]);
  });
  it("ignora le prenotazioni segnate come no-show", () => {
    const out = reorganizeService({ ...base, reservations: [res("A", 2, ["T2"], { no_show: true }), res("B", 2, [])], tables: [t("T2", 2, 0, 0)] });
    expect(out.assignments.get("B")?.ids).toEqual(["T2"]);
  });
});

describe("non-sovrapposizione rigida", () => {
  it("una prenotazione senza posto resta sul suo tavolo e nessun'altra vi viene sovrapposta", () => {
    // G (6p) non trova posto e resta su T2; la piccola non può finire su T2 alla stessa ora.
    const out = reorganizeService({ ...base, reservations: [res("G", 6, ["T2"]), res("P", 2, [])], tables: [t("T2", 2, 0, 0), t("T4", 2, 5, 5)] });
    expect(out.unplaced.map((r) => r.id)).toEqual(["G"]);
    expect(out.assignments.get("P")?.ids).toEqual(["T4"]);
  });
  it("la permanenza ridotta (durata personalizzata) libera il tavolo per la prenotazione successiva", () => {
    const out = reorganizeService({ ...base, reservations: [res("A", 2, [], { time: "19:45", duration_min: 75, buffer_min: 15 }), res("B", 2, [], { time: "21:15" })], tables: [t("T2", 2, 0, 0)] });
    expect(out.unplaced).toHaveLength(0);
  });
  it("tavoli uniti restano occupati per tutta la seduta", () => {
    const out = reorganizeService({ ...base, reservations: [res("G", 8, []), res("P", 2, [], { time: "20:30" })], tables: [t("A", 4, 0, 0), t("B", 4, 1, 0)] });
    expect(out.assignments.get("G")?.ids.sort()).toEqual(["A", "B"]);
    expect(out.unplaced.map((r) => r.id)).toEqual(["P"]);
  });
});
