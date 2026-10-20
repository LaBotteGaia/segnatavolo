/** Maschera un telefono: prime 3 cifre (dopo l'eventuale prefisso +39) e ultime 2 visibili. */
export function maskPhone(phone: string | null | undefined): string {
  const raw = (phone ?? "").replace(/[\s\-.\/()]/g, "");
  if (!raw) return "";
  let prefix = "";
  let digits = raw;
  const m = raw.match(/^(\+\d{2}|0039)(\d+)$/);
  if (m) { prefix = m[1] === "0039" ? "+39 " : m[1] + " "; digits = m[2]!; }
  if (digits.length <= 5) return prefix + digits.slice(0, 1) + "•".repeat(Math.max(digits.length - 1, 0));
  return `${prefix}${digits.slice(0, 3)} ••• ••${digits.slice(-2)}`;
}
