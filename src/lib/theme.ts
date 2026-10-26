import { useEffect, useState } from "react";

const KEY = "segnatavolo-theme";
export type Theme = "light" | "dark";

export function applyTheme(t: Theme) {
  document.documentElement.classList.toggle("dark", t === "dark");
}

export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setTheme] = useState<Theme>("light");
  useEffect(() => { const t: Theme = localStorage.getItem(KEY) === "dark" ? "dark" : "light"; setTheme(t); applyTheme(t); }, []);
  const set = (t: Theme) => { setTheme(t); localStorage.setItem(KEY, t); applyTheme(t); };
  return [theme, set];
}
