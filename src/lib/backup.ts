/** Backup JSON dei ristoranti (pannello Super Admin). */
export type BackupSummary = {
  exportedAt: string | null;
  restaurantName: string;
  rooms: number;
  tables: number;
  reservations: number;
  customers: number;
};

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);

/** Valida la struttura di un backup; restituisce un riepilogo o un messaggio d'errore. */
export function validateBackup(data: unknown): { ok: true; summary: BackupSummary } | { ok: false; error: string } {
  if (!isObj(data)) return { ok: false, error: "Il file non è un backup Segnatavolo valido." };
  for (const key of ["rooms", "tables", "reservations"]) {
    if (!Array.isArray(data[key])) return { ok: false, error: `Il backup non contiene l'elenco "${key}".` };
  }
  const meta = isObj(data["meta"]) ? data["meta"] : {};
  const restaurant = isObj(data["restaurant"]) ? data["restaurant"] : {};
  return {
    ok: true,
    summary: {
      exportedAt: typeof meta["exported_at"] === "string" ? meta["exported_at"] : null,
      restaurantName: typeof restaurant["name"] === "string" ? restaurant["name"] : "",
      rooms: (data["rooms"] as unknown[]).length,
      tables: (data["tables"] as unknown[]).length,
      reservations: (data["reservations"] as unknown[]).length,
      customers: Array.isArray(data["customers"]) ? data["customers"].length : 0,
    },
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** backup-[nome-ristorante]-[YYYY-MM-DD-HHmm].json */
export function backupFileName(name: string, d = new Date()): string {
  const slug = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "ristorante";
  return `backup-${slug}-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.json`;
}

export function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
