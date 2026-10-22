import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Calendar, CalendarDayGesture } from "@/components/ui/calendar";

beforeEach(() => { vi.useFakeTimers(); vi.stubGlobal("PointerEvent", MouseEvent); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function setup() {
  const open = vi.fn(), consult = vi.fn(), vibrate = vi.fn();
  Object.defineProperty(navigator, "vibrate", { configurable: true, value: vibrate });
  function Fixture() {
    const lastTap = useRef<{ key: string; at: number } | null>(null);
    return <CalendarDayGesture.Provider value={{ openDay: open, lastTap }}><Calendar month={new Date(2026, 9, 1)} onDayClick={consult} /></CalendarDayGesture.Provider>;
  }
  render(<Fixture />);
  const day = screen.getByRole("button", { name: /Friday, October 23rd, 2026/ });
  const other = screen.getByRole("button", { name: /Saturday, October 24th, 2026/ });
  return { day, other, open, consult, vibrate };
}
const down = (day: HTMLElement) => fireEvent.pointerDown(day, { button: 0, clientX: 10, clientY: 10 });
const tap = (day: HTMLElement) => { down(day); fireEvent.pointerUp(day); fireEvent.click(day, { detail: 1 }); };

it("il tap singolo consulta senza aprire l’agenda", () => {
  const { day, open, consult } = setup();
  tap(day);
  act(() => vi.advanceTimersByTime(600));
  expect(consult).toHaveBeenCalledTimes(1);
  expect(open).not.toHaveBeenCalled();
});
it("a 500 ms apre il giorno, vibra 40 ms e sopprime anche il click sui pallini", () => {
  const { day, open, consult, vibrate } = setup();
  down(day);
  act(() => vi.advanceTimersByTime(499));
  expect(open).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(1));
  expect(open).toHaveBeenCalledWith(new Date(2026, 9, 23));
  expect(vibrate).toHaveBeenCalledWith(40);
  fireEvent.pointerUp(day); fireEvent.click(day, { detail: 1 });
  expect(consult).not.toHaveBeenCalled();
});
it("doppio tap sulla stessa cella entro 299 ms apre una sola volta", () => {
  const { day, open, consult } = setup();
  tap(day); act(() => vi.advanceTimersByTime(299)); tap(day);
  expect(open).toHaveBeenCalledTimes(1);
  expect(consult).toHaveBeenCalledTimes(1);
});
it("a 300 ms sono due consultazioni, non un doppio tap", () => {
  const { day, open, consult } = setup();
  tap(day); act(() => vi.advanceTimersByTime(300)); tap(day);
  expect(open).not.toHaveBeenCalled(); expect(consult).toHaveBeenCalledTimes(2);
});
it("tap consecutivi su giorni diversi non aprono l’agenda", () => {
  const { day, other, open } = setup();
  tap(day); tap(other); tap(day);
  expect(open).not.toHaveBeenCalled();
});
it("scorrimento e cancellazione interrompono la pressione", () => {
  const { day, open, consult } = setup();
  down(day); fireEvent.pointerMove(day, { clientX: 40, clientY: 10 });
  act(() => vi.advanceTimersByTime(600)); fireEvent.click(day, { detail: 1 });
  down(day); fireEvent.pointerCancel(day);
  act(() => vi.advanceTimersByTime(600));
  expect(open).not.toHaveBeenCalled(); expect(consult).not.toHaveBeenCalled();
});
it("smontaggio cancella il timer e tastiera consulta senza doppio tap", () => {
  const { day, open, consult } = setup();
  fireEvent.click(day); fireEvent.click(day);
  expect(consult).toHaveBeenCalledTimes(2); expect(open).not.toHaveBeenCalled();
  down(day); cleanup(); act(() => vi.advanceTimersByTime(600));
  expect(open).not.toHaveBeenCalled();
});