const KEY = "segnatavolo:return-path";

/** Salva solo percorsi interni sicuri verso l'agenda (link email Accetta/Rifiuta). */
export function rememberReturnPath(href: string) {
  if (typeof window === "undefined") return;
  if (href.startsWith("/agenda?") && !href.startsWith("//")) sessionStorage.setItem(KEY, href);
}

export function takeReturnPath(): string | null {
  if (typeof window === "undefined") return null;
  const v = sessionStorage.getItem(KEY);
  sessionStorage.removeItem(KEY);
  return v && v.startsWith("/agenda?") ? v : null;
}

export function requestActionLink(id: string, action: "accetta" | "rifiuta") {
  return `https://segnatavolo.app/agenda?richiesta=${encodeURIComponent(id)}&azione=${action}`;
}
