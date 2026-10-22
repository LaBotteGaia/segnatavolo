import { z } from 'zod';

export const SMTP_HOSTS = ['smtp.gmail.com', 'smtp.office365.com', 'smtps.aruba.it', 'smtp.mail.yahoo.com', 'smtp.zoho.eu', 'smtp.zoho.com'] as const;
export const EMAIL_PLACEHOLDERS = ['nome_cliente', 'data', 'ora', 'pax', 'tavolo_assegnato', 'note_cliente', 'nome_ristorante', 'telefono_ristorante', 'motivo_rifiuto'] as const;
export const DEFAULT_EMAIL_TEMPLATES = {
  pending: { subject: 'Richiesta ricevuta — {nome_ristorante}', body: 'Buongiorno {nome_cliente},\n\nLa richiesta è in attesa di approvazione: non è ancora confermata.\n{data} alle {ora} · {pax} persone\nNote: {note_cliente}\n\n{nome_ristorante}\n{telefono_ristorante}' },
  confirmed: { subject: 'Prenotazione confermata — {nome_ristorante}', body: 'Buongiorno {nome_cliente},\n\nLa prenotazione è confermata.\n{data} alle {ora} · {pax} persone\nTavolo: {tavolo_assegnato}\nNote: {note_cliente}\n\n{nome_ristorante}\n{telefono_ristorante}' },
  rejected: { subject: 'Richiesta rifiutata — {nome_ristorante}', body: 'Buongiorno {nome_cliente},\n\nLa richiesta del {data} alle {ora} per {pax} persone è stata rifiutata.\nMotivazione: {motivo_rifiuto}\n\n{nome_ristorante}\n{telefono_ristorante}' },
};
const templateSchema = z.object({ subject: z.string().trim().min(1).max(300).regex(/^[^\r\n]*$/), body: z.string().trim().min(1).max(10000) });
export function interpolateEmail(value: string, data: Partial<Record<typeof EMAIL_PLACEHOLDERS[number], string>>) {
  return value.replace(/\{([a-z_]+)\}/g, (match, key: string) => EMAIL_PLACEHOLDERS.some(p => p === key) ? data[key as typeof EMAIL_PLACEHOLDERS[number]] ?? '' : match);
}
export const emailSettingsSchema = z.object({
  staffEmail: z.string().trim().email().max(255).or(z.literal('')).default(''),
  restaurantPhone: z.string().trim().max(40).regex(/^[^\r\n]*$/).default(''),
  templates: z.object({ pending: templateSchema.default(DEFAULT_EMAIL_TEMPLATES.pending), confirmed: templateSchema.default(DEFAULT_EMAIL_TEMPLATES.confirmed), rejected: templateSchema.default(DEFAULT_EMAIL_TEMPLATES.rejected) }).default({}),
  custom: z.boolean().default(false), provider: z.enum(['lovable', 'resend']).default('lovable'),
  host: z.string().max(255).default('smtp.gmail.com'), port: z.union([z.literal(465), z.literal(587)]).default(465),
  security: z.enum(['tls', 'starttls']).default('tls'),
  senderName: z.string().trim().max(150).regex(/^[^\r\n<>]*$/).default(''),
  username: z.string().trim().email().max(255).or(z.literal('')).default(''),
}).superRefine((value, ctx) => {
  if (value.custom && (!SMTP_HOSTS.some(host => host === value.host) || !value.username || (value.port === 465 ? value.security !== 'tls' : value.security !== 'starttls'))) ctx.addIssue({ code: 'custom', message: 'Usa un server supportato, un mittente valido e sicurezza coerente con la porta.' });
});
export type EmailSettings = z.infer<typeof emailSettingsSchema>;