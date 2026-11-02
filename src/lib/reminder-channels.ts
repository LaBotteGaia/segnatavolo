export type ReminderChannel = 'email' | 'whatsapp';
export type ReminderPreference = 'automatic' | ReminderChannel;
export type ReminderDefault = 'ask' | ReminderChannel;
export function reminderChoice(phone: string | null, email: string | null, preference: ReminderPreference, defaultChannel: ReminderDefault): ReminderChannel | 'ask' | 'unavailable' {
  if (!phone && !email) return 'unavailable';
  if (!phone) return 'email';
  if (!email) return 'whatsapp';
  if (preference !== 'automatic') return preference;
  return defaultChannel;
}
export function reminderWhatsAppUrl(phone: string, text: string) {
  let digits = phone.replace(/[^0-9+]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  else if (digits.startsWith('00')) digits = digits.slice(2);
  else digits = `39${digits}`;
  if (!/^\d{8,15}$/.test(digits)) throw new Error('Numero WhatsApp non valido');
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}