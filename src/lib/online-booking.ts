import { z } from 'zod';
const clockSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).refine(v=>Number(v.slice(3))%15===0,'Scegli un orario ogni 15 minuti');
const windowSchema = z.object({first_to:clockSchema,second_from:clockSchema}).refine(v=>v.first_to<v.second_from,'Il secondo turno deve iniziare dopo il primo');
export const onlineConfigSchema = z.object({ double_windows:z.object({pranzo:windowSchema.default({first_to:'12:45',second_from:'14:30'}),sera:windowSchema.default({first_to:'19:45',second_from:'21:30'})}).default({}), max_party_size: z.number().int().min(1).max(100).default(6), max_days: z.number().int().min(1).max(365).default(30), cutoff: z.enum(['hours','previous_day','24h','48h']).default('hours'), cutoff_hours: z.number().int().min(0).max(72).default(2), closed_message: z.string().trim().max(1000).default('Per prenotazioni dell’ultimo minuto contatta direttamente il ristorante.') });
export const slugSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{1,79}$/, 'Usa almeno 2 caratteri: lettere minuscole, numeri e trattini');
export const slugFromName = (name: string) => name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80);
export const bookingSchema = z.object({ slug: slugSchema, request_id: z.string().uuid(), people: z.number().int().min(1).max(100), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), shift: z.enum(['pranzo','sera']), time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), name: z.string().trim().min(2).max(150), phone: z.string().transform(p=>p.replace(/[\s\-./()]/g,'')).pipe(z.string().regex(/^\+?\d{7,15}$/, 'Inserisci un cellulare valido')), email: z.string().trim().email().max(255), notes: z.string().trim().max(1000), outside: z.boolean(), privacy: z.literal(true), marketing: z.boolean() });
export type OnlineConfig = z.infer<typeof onlineConfigSchema>;
export type OnlinePage = { name: string; address: string; logo: string; today: string; config: OnlineConfig; shifts: Record<'pranzo'|'sera',{enabled:boolean;from:string;to:string}>; days: {date:string;pranzo:number|null;sera:number|null}[] };
export function dayAvailable(day: OnlinePage['days'][number], people: number) { return (day.pranzo ?? -1)>=people || (day.sera ?? -1)>=people; }

export type OnlineSlot = { time: string; remaining: number | null; turn?: number };
export function slotGroups(slots: OnlineSlot[]) {
 return slots.some(s=>s.turn===1||s.turn===2) ? [1,2].map(turn=>({label:`${turn}° Turno`,slots:slots.filter(s=>s.turn===turn)})) : [{label:'',slots}];
}
export function partyLimit(remaining: number | null | undefined, maximum: number) { return Math.max(0, Math.min(remaining ?? 0, maximum)); }
export function confirmedBooking(row: { status?: string }) { return row.status === undefined || row.status === "confirmed"; }
