import { useEffect, useRef, type MouseEvent, type PointerEvent } from "react";

export type CalendarTapTracker = { current: { key: string; at: number } | null };

/** Pointer events cover mouse, touch and pen without duplicate touch/mouse timers. */
export function useCalendarGesture(key: string, openDay: (() => void) | undefined, lastTap: CalendarTapTracker) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const suppressClick = useRef(false);
  const clear = () => { if (timer.current !== null) clearTimeout(timer.current); timer.current = null; origin.current = null; };
  useEffect(() => clear, [key, openDay]);
  const activate = () => {
    clear();
    lastTap.current = null;
    suppressClick.current = true;
    try { navigator.vibrate?.(40); } catch { /* Haptics are optional. */ }
    openDay?.();
  };
  return {
    onPointerDown: (e: PointerEvent<HTMLButtonElement>) => {
      if (!openDay || e.button !== 0 || e.isPrimary === false) return;
      clear(); suppressClick.current = false;
      origin.current = { x: e.clientX, y: e.clientY };
      timer.current = setTimeout(activate, 500);
    },
    onPointerUp: clear,
    onPointerCancel: () => { clear(); lastTap.current = null; suppressClick.current = true; },
    onPointerLeave: clear,
    onPointerMove: (e: PointerEvent<HTMLButtonElement>) => {
      const start = origin.current;
      if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 10) {
        clear(); lastTap.current = null; suppressClick.current = true;
      }
    },
    onContextMenu: (e: MouseEvent<HTMLButtonElement>) => { if (openDay) e.preventDefault(); },
    onClickCapture: (e: MouseEvent<HTMLButtonElement>) => {
      if (!openDay) return;
      if (suppressClick.current) { e.preventDefault(); e.stopPropagation(); return; }
      // Keyboard activation remains a single availability consultation.
      if (e.detail === 0) return;
      const now = Date.now(), previous = lastTap.current;
      if (previous?.key === key && now - previous.at < 300) {
        e.preventDefault(); e.stopPropagation(); activate();
      } else lastTap.current = { key, at: now };
    },
  };
}