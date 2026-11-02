import { describe, it, expect } from 'vitest';
import { toWhatsAppDigits } from '@/lib/whatsapp.server';
describe('numero WhatsApp destinatario', () => {
  it('aggiunge 39 ai numeri italiani senza prefisso', () => expect(toWhatsAppDigits('333 123 4567')).toBe('393331234567'));
  it('rimuove + e 00 dai prefissi internazionali', () => { expect(toWhatsAppDigits('+39 333-1234567')).toBe('393331234567'); expect(toWhatsAppDigits('0041791234567')).toBe('41791234567'); });
});
