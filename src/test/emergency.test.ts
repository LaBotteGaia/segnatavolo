import { describe, expect, it } from "vitest";
import { escapeHtml } from "@/lib/emergency";
import { interval, fmt } from "@/lib/rotation";
import { formatInTimeZone } from "@/lib/audit";
import { OFFLINE_TTL } from "@/lib/live-sync";

describe("piano di emergenza e audit", () => {
  it("la copia locale ha validità di un minuto", () => expect(OFFLINE_TTL).toBe(60_000));
  it("il piano conserva permanenza 1h30 e buffer 15 minuti", () => {
    const slot = interval({ time: "20:00" }, { duration: 90, buffer: 15 });
    expect(fmt(slot.end)).toBe("21:30"); expect(fmt(slot.free)).toBe("21:45");
  });
  it("nomi e note scaricati non eseguono contenuto attivo", () => expect(escapeHtml('<script>alert("x")</script>')).toBe('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;'));
  it("l’attribuzione operatore usa l’ora italiana", () => expect(formatInTimeZone("2026-10-20T18:25:00Z")).toBe("20/10 alle 20:25"));
});