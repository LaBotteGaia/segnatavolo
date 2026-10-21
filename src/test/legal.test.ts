import { describe, expect, it } from "vitest";
import { COPYRIGHT_LINE, DELETE_ACCOUNT_WARNING, LEGAL_LINK_LABEL, LEGAL_URL, SERVER_REGION_LINE } from "@/lib/legal";

describe("riferimenti legali", () => {
  it("il link Termini e Privacy punta all'URL ufficiale", () => {
    expect(LEGAL_URL).toBe("https://www.labottegaia.it/termini-e-condizioni-segnatavolo/");
  });

  it("il copyright nomina Osteria La BotteGaia", () => {
    expect(COPYRIGHT_LINE).toContain("Osteria La BotteGaia");
  });

  it("l'ambiente server dichiara la regione UE conforme GDPR", () => {
    expect(SERVER_REGION_LINE).toContain("Unione Europea");
    expect(SERVER_REGION_LINE).toContain("GDPR");
  });

  it("l'avviso di eliminazione account menziona revoca immediata e conservazione dell'audit", () => {
    expect(DELETE_ACCOUNT_WARNING).toContain("revocato immediatamente");
    expect(DELETE_ACCOUNT_WARNING).toContain("log di audit");
  });

  it("l'etichetta del link legale è completa", () => {
    expect(LEGAL_LINK_LABEL).toBe("Termini di Servizio e Privacy Policy");
  });
});
