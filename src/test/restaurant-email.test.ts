import { describe, it, expect } from 'vitest';
import { emailSettingsSchema, interpolateEmail } from '@/lib/restaurant-email';

const smtp = { custom: true, host: 'smtp.gmail.com', username: 'locale@example.com', port: 465, security: 'tls' };
describe('posta ristorante', () => {
  it('interpola i dati cliente e tavoli senza interpretare altri segnaposto',()=>expect(interpolateEmail('{nome_cliente}: {pax} · {tavolo_assegnato} {sconosciuto}',{nome_cliente:'Mario',pax:'9',tavolo_assegnato:'5 + 6'})).toBe('Mario: 9 · 5 + 6 {sconosciuto}'));
  it('salva template distinti e indirizzo maître valido',()=>{const cfg=emailSettingsSchema.parse({staffEmail:'maitre@example.com'});expect(cfg.staffEmail).toBe('maitre@example.com');expect(cfg.templates.pending.body).not.toBe(cfg.templates.confirmed.body);expect(emailSettingsSchema.safeParse({staffEmail:'non-email'}).success).toBe(false);});
  it('respinge ritorni a capo negli oggetti',()=>expect(emailSettingsSchema.safeParse({templates:{pending:{subject:'Prova\nBcc: altra@example.com',body:'Test'}}}).success).toBe(false));
  it('accetta SMTP 465 soltanto con TLS', () => { expect(emailSettingsSchema.safeParse(smtp).success).toBe(true); expect(emailSettingsSchema.safeParse({ ...smtp, security: 'starttls' }).success).toBe(false); });
  it('accetta SMTP 587 soltanto con STARTTLS', () => { expect(emailSettingsSchema.safeParse({ ...smtp, port: 587, security: 'starttls' }).success).toBe(true); expect(emailSettingsSchema.safeParse({ ...smtp, port: 587 }).success).toBe(false); });
  it('non permette connessioni a indirizzi privati o host arbitrari', () => { expect(emailSettingsSchema.safeParse({ ...smtp, host: '127.0.0.1' }).success).toBe(false); expect(emailSettingsSchema.safeParse({ ...smtp, host: 'arbitrary.example.com' }).success).toBe(false); });
  it('consente la scelta fra Resend e Email Lovable', () => { expect(emailSettingsSchema.parse({ provider: 'resend' }).provider).toBe('resend'); expect(emailSettingsSchema.parse({ provider: 'lovable' }).provider).toBe('lovable'); });
});