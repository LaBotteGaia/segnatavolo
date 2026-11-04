import { describe, expect, it } from 'vitest';
import { controllerName, legalPath, noShowTolerance, SUB_PROCESSORS } from '@/lib/restaurant-legal';
import { identitySchema } from '@/lib/restaurant-identity';

describe('pagine legali ristorante', () => {
  it('usa la ragione sociale come Titolare, altrimenti il nome', () => {
    expect(controllerName({ legal_name: 'BotteGaia S.r.l.', name: 'Osteria' })).toBe('BotteGaia S.r.l.');
    expect(controllerName({ legal_name: '  ', name: 'Osteria' })).toBe('Osteria');
  });
  it('tolleranza no-show predefinita 15 minuti', () => {
    expect(noShowTolerance(0)).toBe(15);
    expect(noShowTolerance(20)).toBe(20);
  });
  it('percorso pubblico per slug', () => { expect(legalPath('la-bottegaia')).toBe('/prenota/la-bottegaia/legal'); });
  it('elenca Meta come sub-responsabile WhatsApp', () => { expect(SUB_PROCESSORS.some(s => s.name.includes('Meta Platforms Ireland'))).toBe(true); });
  it('rifiuta URL privacy non HTTPS', () => {
    const base = { name: 'X', public_address: '', public_logo_url: '', website_url: '', main_email: '', main_phone: '', main_whatsapp: '', vat_number: '', legal_name: '', registered_address: '', privacy_email: '', timezone: 'Europe/Rome' };
    expect(identitySchema.safeParse({ ...base, custom_privacy_url: 'http://x.it' }).success).toBe(false);
    expect(identitySchema.safeParse({ ...base, custom_privacy_url: 'https://x.it/privacy' }).success).toBe(true);
  });
});
