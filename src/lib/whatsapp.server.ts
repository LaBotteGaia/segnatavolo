// Invio tramite la linea WhatsApp Business del singolo ristorante (Meta Cloud API).
// Le credenziali sono per-ristorante, cifrate e lette solo lato server.
export const whatsappAad = (id: string) => `whatsapp:${id}`;

export type WhatsAppConfig = { enabled: boolean; phoneNumberId: string; token: string; templateName: string | null; templateLanguage: string };

export async function loadWhatsAppConfig(restaurantId: string): Promise<WhatsAppConfig | null> {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data: row } = await supabaseAdmin.from('restaurant_whatsapp_settings').select('*').eq('restaurant_id', restaurantId).maybeSingle();
  if (!row?.encrypted_token || !row.phone_number_id) return null;
  const { decryptPassword } = await import('./restaurant-email.server');
  return { enabled: row.enabled, phoneNumberId: row.phone_number_id, token: await decryptPassword(row.encrypted_token, whatsappAad(restaurantId)), templateName: row.template_name, templateLanguage: row.template_language };
}

export const toWhatsAppDigits = (phone: string) => {
  let d = phone.replace(/[^\d+]/g, '');
  if (d.startsWith('+')) d = d.slice(1); else if (d.startsWith('00')) d = d.slice(2); else if (d.length <= 10) d = `39${d}`;
  return d.replace(/\D/g, '');
};

/** Scambia l'authorization code dell'Embedded Signup Meta con un access token di sistema. */
export async function exchangeMetaCode(code: string): Promise<{ ok: true; token: string } | { ok: false; message: string }> {
  const appId = process.env['META_APP_ID'];
  const appSecret = process.env['META_APP_SECRET'];
  if (!appId || !appSecret) return { ok: false, message: 'Configurazione Meta della piattaforma non completata.' };
  try {
    const url = `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${encodeURIComponent(appId)}&client_secret=${encodeURIComponent(appSecret)}&code=${encodeURIComponent(code)}`;
    const res = await fetch(url);
    const text = await res.text();
    if (!res.ok) {
      console.error(`Meta token exchange failed [${res.status}]: ${text}`);
      let msg = `Errore Meta ${res.status}`;
      try { const j = JSON.parse(text) as { error?: { message?: string } }; if (j.error?.message) msg += `: ${j.error.message}`; } catch { /* corpo non JSON */ }
      return { ok: false, message: msg.slice(0, 300) };
    }
    const j = JSON.parse(text) as { access_token?: string };
    if (!j.access_token) return { ok: false, message: 'Meta non ha restituito il token di accesso.' };
    return { ok: true, token: j.access_token };
  } catch { return { ok: false, message: 'Server Meta non raggiungibile.' }; }
}

export async function sendWhatsApp(cfg: Pick<WhatsAppConfig, 'phoneNumberId' | 'token'>, to: string, body: object): Promise<{ ok: true; id: string | null } | { ok: false; message: string }> {
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(cfg.phoneNumberId)}/messages`, {
      method: 'POST', headers: { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: toWhatsAppDigits(to), ...body }),
    });
    const text = await res.text();
    if (!res.ok) {
      console.error(`WhatsApp send failed [${res.status}]: ${text}`);
      let msg = `Errore Meta ${res.status}`;
      try { const j = JSON.parse(text) as { error?: { message?: string } }; if (j.error?.message) msg += `: ${j.error.message}`; } catch { /* corpo non JSON */ }
      return { ok: false, message: msg.slice(0, 300) };
    }
    const j = JSON.parse(text) as { messages?: { id?: string }[] };
    return { ok: true, id: j.messages?.[0]?.id ?? null };
  } catch { return { ok: false, message: 'Server WhatsApp non raggiungibile' }; }
}
