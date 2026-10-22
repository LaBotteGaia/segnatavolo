import { z } from 'zod';

export const SMTP_HOSTS = ['smtp.gmail.com', 'smtp.office365.com', 'smtps.aruba.it', 'smtp.mail.yahoo.com', 'smtp.zoho.eu', 'smtp.zoho.com'] as const;
export const emailSettingsSchema = z.object({
  custom: z.boolean().default(false), provider: z.enum(['lovable', 'resend']).default('lovable'),
  host: z.string().max(255).default('smtp.gmail.com'), port: z.union([z.literal(465), z.literal(587)]).default(465),
  security: z.enum(['tls', 'starttls']).default('tls'),
  senderName: z.string().trim().max(150).regex(/^[^\r\n<>]*$/).default(''),
  username: z.string().trim().email().max(255).or(z.literal('')).default(''),
}).superRefine((value, ctx) => {
  if (value.custom && (!SMTP_HOSTS.some(host => host === value.host) || !value.username || (value.port === 465 ? value.security !== 'tls' : value.security !== 'starttls'))) ctx.addIssue({ code: 'custom', message: 'Usa un server supportato, un mittente valido e sicurezza coerente con la porta.' });
});
export type EmailSettings = z.infer<typeof emailSettingsSchema>;