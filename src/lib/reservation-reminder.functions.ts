import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { emailSettingsSchema, interpolateEmail } from './restaurant-email';
import { reminderWhatsAppUrl } from './reminder-channels';

export const sendReservationReminder = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ restaurantId: z.string().uuid(), reservationId: z.string().uuid(), channel: z.enum(['email','whatsapp']) }).parse(input))
  .handler(async ({ data, context }) => {
    // Authorize against membership, never infer access from the browser's tenant selection.
    const { data: membership, error: memberError } = await context.supabase.from('restaurant_members').select('id').eq('restaurant_id', data.restaurantId).eq('user_id', context.userId).eq('status','active').maybeSingle();
    const { data: assistance, error: adminError } = await context.supabase.rpc('is_super_admin');
    if (memberError || adminError || (!membership && !assistance)) throw new Error('Non autorizzato per questo ristorante');
    const { data: booking, error } = await context.supabase.from('reservations').select('*').eq('restaurant_id', data.restaurantId).eq('id', data.reservationId).eq('status','confirmed').is('deleted_at',null).single();
    if (error || !booking) throw new Error('Prenotazione non disponibile');
    const { data: restaurant, error: restaurantError } = await context.supabase.from('restaurants').select('name,main_phone').eq('id',data.restaurantId).single();
    if (restaurantError) throw new Error('Ristorante non disponibile');
    let customerEmail = booking.contact_email ?? '';
    if (!customerEmail && booking.customer_id) {
      const { data: customer, error: customerError } = await context.supabase.from('customers').select('emails').eq('id',booking.customer_id).eq('restaurant_id',data.restaurantId).maybeSingle();
      if (customerError) throw new Error('Contatti non disponibili');
      customerEmail = customer?.emails[0] ?? '';
    }
    if (data.channel === 'email' && !z.string().email().safeParse(customerEmail).success) throw new Error('Email cliente non disponibile');
    if (data.channel === 'whatsapp' && !booking.phone) throw new Error('Telefono cliente non disponibile');
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: delivery, error: deliveryError } = await supabaseAdmin.from('restaurant_delivery_settings').select('settings').eq('restaurant_id',data.restaurantId).maybeSingle();
    if (deliveryError) throw new Error('Template non disponibile');
    const template = emailSettingsSchema.parse(delivery?.settings ?? {}).templates.reminder;
    const vars = { nome_cliente: booking.name, telefono_cliente: booking.phone ?? '', email_cliente: customerEmail, data: booking.date.split('-').reverse().join('/'), ora: booking.time, pax: String(booking.people), nome_ristorante: restaurant.name, telefono_ristorante: restaurant.main_phone ?? '', note_cliente: booking.notes ?? '' };
    let text = interpolateEmail(template.body,vars);
    if (booking.channel === 'online' && booking.management_token) text += `\n\nMODIFICA O ANNULLA PRENOTAZIONE\nhttps://segnatavolo.app/prenotazione/gestisci?token=${booking.management_token}`;
    // Linea WhatsApp Business del ristorante: usabile da ogni membro attivo, credenziali solo lato server.
    const { loadWhatsAppConfig, sendWhatsApp } = await import('./whatsapp.server');
    const wa = data.channel === 'whatsapp' ? await loadWhatsAppConfig(data.restaurantId) : null;
    if (wa?.enabled) {
      const { data: log, error: logError } = await supabaseAdmin.from('reservation_reminder_logs').insert({ restaurant_id:data.restaurantId, reservation_id:booking.id, channel:'whatsapp', operator_id:context.userId, outcome:'sending', detail:null }).select('id').single();
      if (logError || !log) throw new Error('Promemoria non registrato: invio non avviato');
      const body = wa.templateName
        ? { type:'template', template:{ name:wa.templateName, language:{ code:wa.templateLanguage }, components:[{ type:'body', parameters:[vars.nome_cliente,vars.data,vars.ora,vars.pax].map(t=>({ type:'text', text:t })) }] } }
        : { type:'text', text:{ body:text } };
      const r = await sendWhatsApp(wa, booking.phone ?? '', body);
      const detail = r.ok ? `Accettato da Meta${r.id ? ` (${r.id})` : ''}; consegna non ancora confermata.` : r.message;
      await supabaseAdmin.from('reservation_reminder_logs').update({ outcome:r.ok ? 'accepted' : 'failed', detail }).eq('restaurant_id',data.restaurantId).eq('id',log.id);
      return { sent:r.ok, url:null, message:r.ok ? 'Promemoria inviato dal numero WhatsApp del ristorante.' : `WhatsApp non inviato: ${r.message}` };
    }
    const url = data.channel === 'whatsapp' ? reminderWhatsAppUrl(booking.phone ?? '',text) : null;
    const { data: log, error: logError } = await supabaseAdmin.from('reservation_reminder_logs').insert({ restaurant_id:data.restaurantId, reservation_id:booking.id, channel:data.channel, operator_id:context.userId, outcome:data.channel === 'whatsapp' ? 'opened' : 'sending', detail:data.channel === 'whatsapp' ? 'Messaggio preparato per apertura WhatsApp; invio e consegna non verificabili.' : null }).select('id').single();
    if (logError || !log) throw new Error('Promemoria non registrato: invio non avviato');
    if (url) return { sent:false, url, message:'Messaggio preparato: conferma l’invio su WhatsApp.' };
    const { sendRestaurantMessage } = await import('./restaurant-email.server');
    const result = await sendRestaurantMessage(data.restaurantId,customerEmail,interpolateEmail(template.subject,vars).replace(/[\r\n]/g,' '),text);
    const { error: outcomeError } = await supabaseAdmin.from('reservation_reminder_logs').update({ outcome:result.sent ? 'accepted' : 'failed', detail:result.message }).eq('restaurant_id',data.restaurantId).eq('id',log.id);
    if (outcomeError) throw new Error('Esito invio non registrato: verifica prima di riprovare');
    return { ...result, url:null };
  });