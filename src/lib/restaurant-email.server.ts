import { emailSettingsSchema, type EmailSettings } from './restaurant-email';

async function encryptionKey() {
  const secret = process.env['RESTAURANT_EMAIL_ENCRYPTION_KEY'];
  if (!secret) throw new Error('Protezione credenziali non disponibile');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
export async function encryptPassword(password: string, restaurantId: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(restaurantId) }, await encryptionKey(), new TextEncoder().encode(password)));
  return btoa(String.fromCharCode(...iv, ...encrypted));
}
async function decryptPassword(value: string, restaurantId: string) {
  const bytes = Uint8Array.from(atob(value), c => c.charCodeAt(0));
  return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12), additionalData: new TextEncoder().encode(restaurantId) }, await encryptionKey(), bytes.slice(12)));
}
export async function sendRestaurantMessage(restaurantId: string, to: string, subject: string, text: string) {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data, error } = await supabaseAdmin.from('restaurant_delivery_settings').select('settings,encrypted_password').eq('restaurant_id', restaurantId).maybeSingle();
  if (error) return { sent: false, message: 'Configurazione posta non raggiungibile.' };
  const parsed = emailSettingsSchema.safeParse(data?.settings ?? {});
  if (!parsed.success) return { sent: false, message: 'Configurazione posta non valida.' };
  const settings: EmailSettings = parsed.data;
  if (!settings.custom) return { sent: false, message: settings.provider === 'resend' ? 'Resend non collegato: configura il servizio predefinito prima di inviare.' : 'Email Lovable non attiva: configura il dominio mittente prima di inviare.' };
  if (!data?.encrypted_password) return { sent: false, message: 'Inserisci e salva la password SMTP.' };
  try {
    const { sendMail } = await import('cloudflare-smtp');
    const password = await decryptPassword(data.encrypted_password, restaurantId);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([sendMail({ host: settings.host, port: settings.port, username: settings.username, password, from: settings.username, to, secureTransport: settings.security }, { subject: `${settings.senderName || 'Segnatavolo'} — ${subject}`, text }), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('smtp_timeout')), 12000); })]);
      return { sent: true, message: 'Email inviata al server di posta.' };
    } finally { if (timer) clearTimeout(timer); }
  } catch {
    return { sent: false, message: 'Invio SMTP non confermato. Verifica credenziali e connessione del servizio pubblicato prima di riprovare.' };
  }
}
export async function sendBookingNotification(restaurantId: string, id: string) {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data: booking, error } = await supabaseAdmin.from('reservations').select('name,date,time,shift,people,contact_email,status,rejection_reason').eq('restaurant_id', restaurantId).eq('id', id).eq('channel', 'online').single();
  if (error || !booking?.contact_email) return { sent: false, message: 'Email cliente non disponibile.' };
  const { data: restaurant } = await supabaseAdmin.from('restaurants').select('name,public_address').eq('id', restaurantId).single();
  const subject = booking.status === 'pending' ? 'Richiesta ricevuta — in attesa di approvazione' : booking.status === 'confirmed' ? 'Prenotazione confermata' : 'Richiesta di prenotazione rifiutata';
  const detail = booking.status === 'pending' ? 'La richiesta è in attesa di approvazione. Non è ancora una prenotazione confermata.' : booking.status === 'confirmed' ? 'Il ristorante ha confermato la prenotazione e assegnato il tavolo.' : `Motivazione: ${booking.rejection_reason ?? ''}`;
  return sendRestaurantMessage(restaurantId, booking.contact_email, subject, `Buongiorno ${booking.name},\n\n${detail}\n\n${restaurant?.name ?? 'Ristorante'}\n${restaurant?.public_address ?? ''}\nData: ${booking.date.split('-').reverse().join('/')}\n${booking.shift === 'pranzo' ? 'Pranzo' : 'Cena'}: ${booking.time}\nCoperti: ${booking.people}\nRiferimento: ${id}\n\nSegnatavolo`);
}