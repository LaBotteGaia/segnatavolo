/** Dati e regole pure per le pagine legali dei singoli ristoranti (Titolare del trattamento). */

export type RestaurantLegal = {
  slug: string;
  name: string;
  logo: string;
  legal_name: string;
  vat_number: string;
  registered_address: string;
  privacy_email: string;
  custom_privacy_url: string;
  no_show_tolerance_minutes: number;
  morning_reminder_enabled: boolean;
  first_shift_duration_minutes: number;
};

/** Sub-responsabili del trattamento (art. 28.2 GDPR) usati da Segnatavolo. */
export const SUB_PROCESSORS = [
  { name: 'Supabase Inc. / Lovable Cloud', role: 'Hosting e database', note: 'Infrastruttura cloud con server in Unione Europea e Clausole Contrattuali Standard.' },
  { name: 'Meta Platforms Ireland Ltd.', role: 'Canale WhatsApp Business', note: 'Solo per i messaggi inviati tramite WhatsApp Cloud API dalla linea del ristorante.' },
  { name: 'Provider email transazionale', role: 'Email di servizio', note: 'Server SMTP configurato dal ristorante o provider integrato (es. Resend, Postmark, SendGrid).' },
] as const;

/** Denominazione del Titolare: ragione sociale se presente, altrimenti nome commerciale. */
export function controllerName(r: Pick<RestaurantLegal, 'legal_name' | 'name'>): string {
  return r.legal_name.trim() || r.name;
}

/** Tolleranza no-show mostrata ai clienti: valore del locale, 15 minuti se assente o non valido. */
export function noShowTolerance(minutes: number | null | undefined): number {
  return typeof minutes === 'number' && Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes) : 15;
}

export function legalPath(slug: string): string {
  return `/prenota/${encodeURIComponent(slug)}/legal`;
}
