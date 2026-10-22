import { describe, expect, it } from "vitest";
import { normalizeVoiceBooking } from "@/lib/voice-ai";
describe("dettatura vocale", () => {
  it("normalizza i campi estratti", () => {
    const b = normalizeVoiceBooking({ customer_name: " Rossi ", phone: "333 12-34", pax: "4", date: "2026-10-23", time: "20:30", notes: "uno celiaco", is_outdoor: false }, "2026-10-22");
    expect(b).toEqual({ customer_name: "Rossi", phone: "3331234", pax: 4, date: "2026-10-23", time: "20:30", notes: "uno celiaco", is_outdoor: false });
  });
  it("arrotonda l'orario al quarto d'ora e usa oggi se manca la data", () => {
    const b = normalizeVoiceBooking({ pax: 2, time: "20:20" }, "2026-10-22");
    expect(b.time).toBe("20:15"); expect(b.date).toBe("2026-10-22");
  });
});
