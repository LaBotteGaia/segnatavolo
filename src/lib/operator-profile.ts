export const OPERATIONAL_ROLES = ["Titolare / Master", "Maître", "Cameriere", "Sommelier", "Hostess / Accoglienza", "Altro"] as const;

export function passwordError(password: string, confirmation: string): string | null {
  if (password.length < 8) return "La nuova password deve contenere almeno 8 caratteri";
  if (password !== confirmation) return "Le password non coincidono";
  return null;
}