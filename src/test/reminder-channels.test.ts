import { describe,it,expect } from 'vitest';
import { reminderChoice,reminderWhatsAppUrl } from '@/lib/reminder-channels';
describe('canali promemoria',()=>{
  it('solo email usa email anche con preferenza WhatsApp',()=>expect(reminderChoice(null,'cliente@example.com','whatsapp','whatsapp')).toBe('email'));
  it('solo telefono usa WhatsApp anche con preferenza email',()=>expect(reminderChoice('+393331234567',null,'email','email')).toBe('whatsapp'));
  it('con entrambi e scelta ogni volta richiede conferma',()=>expect(reminderChoice('+393331234567','cliente@example.com','automatic','ask')).toBe('ask'));
  it('preferenza prenotazione prevale sul default',()=>expect(reminderChoice('+393331234567','cliente@example.com','email','whatsapp')).toBe('email'));
  it('automatico eredita il default del locale',()=>expect(reminderChoice('+393331234567','cliente@example.com','automatic','email')).toBe('email'));
  it('senza contatti non invia',()=>expect(reminderChoice(null,null,'automatic','ask')).toBe('unavailable'));
  it('normalizza numero italiano e codifica testo',()=>expect(reminderWhatsAppUrl('333 123-4567','Ciao & grazie')).toBe('https://wa.me/393331234567?text=Ciao%20%26%20grazie'));
  it('mantiene prefisso estero esplicito',()=>expect(reminderWhatsAppUrl('0044 7700 900123','Ciao')).toBe('https://wa.me/447700900123?text=Ciao'));
});