import { z } from 'zod';

export const MASTER_ONLY_MESSAGE = "Modifica non consentita: permessi riservati all'utente Master del ristorante";
export const assignmentRulesSchema = z.object({
  longStay: z.object({ enabled: z.boolean(), from: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/) }),
  protectModular: z.boolean(),
});
export type AssignmentRules = z.infer<typeof assignmentRulesSchema>;
export const DEFAULT_ASSIGNMENT_RULES: AssignmentRules = { longStay: { enabled: false, from: '21:00' }, protectModular: false };
export function normalizeAssignmentRules(raw: unknown): AssignmentRules {
  const parsed = assignmentRulesSchema.safeParse(raw);
  return parsed.success ? parsed.data : { ...DEFAULT_ASSIGNMENT_RULES, longStay: { ...DEFAULT_ASSIGNMENT_RULES.longStay } };
}
export const isLongStay = (r: { time: string; notes?: string | null; duration_min?: number | null }, rules: AssignmentRules) =>
  rules.longStay.enabled && (r.time >= rules.longStay.from || (r.duration_min ?? 0) < 0 || /(?:seduta lunga|permanenza lunga|tutta la sera|tutta la serata|no[ -]?(?:turnover|rotazione)|non (?:libera|liberano|liberiamo)|senza (?:rotazione|doppio turno))/i.test(r.notes ?? ''));

type RuleTable = { room_id: string; accoppiabile?: boolean; adatto_seduta_lunga?: boolean };
export function assignmentPreference(t: RuleTable, r: { time: string; notes?: string | null; duration_min?: number | null }, rules: AssignmentRules, rooms: { id: string; environment?: string | null }[]): number {
  if (!isLongStay(r, rules)) return 0;
  if (t.adatto_seduta_lunga) return 0;
  if (t.accoppiabile === false) return 1;
  if (rooms.find(room => room.id === t.room_id)?.environment === 'esterno') return 2;
  return 3;
}
export function protectSmallParty<T extends RuleTable>(tables: T[], people: number, rules: AssignmentRules): T[] {
  if (!rules.protectModular || (people !== 2 && people !== 3)) return tables;
  const islands = tables.filter(t => t.accoppiabile === false);
  return islands.length ? islands : tables;
}

export function configurationError(error: { code?: string; message?: string } | null): string {
  return error?.code === '42501' || error?.message?.includes('Master') ? MASTER_ONLY_MESSAGE : 'Salvataggio non riuscito';
}