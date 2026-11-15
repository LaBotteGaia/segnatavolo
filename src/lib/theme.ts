import { useEffect, useState } from "react";

const KEY = "segnatavolo-theme";
export type Theme = "light" | "dark" | "eink";

export function parseTheme(v: string | null): Theme {
  return v === "dark" || v === "eink" ? v : "light";
}

export function applyTheme(t: Theme) {
  document.documentElement.classList.toggle("dark", t === "dark");
  document.documentElement.classList.toggle("eink", t === "eink");
}

export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setTheme] = useState<Theme>("light");
  useEffect(() => { const t = parseTheme(localStorage.getItem(KEY)); setTheme(t); applyTheme(t); }, []);
  const set = (t: Theme) => { setTheme(t); localStorage.setItem(KEY, t); applyTheme(t); };
  return [theme, set];
}
