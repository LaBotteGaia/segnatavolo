import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { VoiceDictation } from '@/components/agenda/VoiceDictation';
import { normalizeVoiceBooking } from '@/lib/voice-ai';
import type { VoiceDateContext } from '@/lib/voice-date';

const mocks = vi.hoisted(() => ({ parse: vi.fn(), load: vi.fn() }));
vi.mock('@/lib/tenant', () => ({ useActiveRestaurantId: () => '11111111-2222-4333-8444-555555555555' }));
vi.mock('@/lib/voice-ai.functions', () => ({ getAiSettings: 'settings', parseVoiceBooking: 'parse' }));
vi.mock('@tanstack/react-start', () => ({ useServerFn: (fn: string) => fn === 'settings' ? mocks.load : mocks.parse }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('invia il contesto locale e la data aperta solo dopo conferma e restituisce la prenotazione su quella data', async () => {
  let recognition: { onresult?: (e: unknown) => void; onend?: () => void } | undefined;
  class Recognition {
    continuous = true;
    interimResults = true;
    constructor() { recognition = this; }
    onresult?: (e: unknown) => void;
    onend?: () => void;
    start() { expect(this.continuous).toBe(false); expect(this.interimResults).toBe(false); }
    stop() { this.onend?.(); }
    abort() {}
  }
  vi.stubGlobal('SpeechRecognition', Recognition);
  const now = new Date(2026, 9, 22, 23, 30);
  vi.spyOn(globalThis, 'Date').mockImplementation(function (...args: unknown[]) {
    return args.length ? new originalDate(...args as [string]) : now;
  } as DateConstructor);
  mocks.load.mockResolvedValue({ ready: true });
  mocks.parse.mockImplementation(async ({ data }: { data: VoiceDateContext & { transcript: string } }) => ({
    ok: true, booking: normalizeVoiceBooking({ customer_name: 'Rossi', pax: 4, time: '20:30', date: '2027-01-01' }, data.current_date, data, data.transcript),
  }));
  const result = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><VoiceDictation selectedDate="2026-11-10" onResult={result} /></QueryClientProvider>);
  await waitFor(() => expect(mocks.load).toHaveBeenCalled());
  await waitFor(() => expect(client.getQueryData(['ai-settings', '11111111-2222-4333-8444-555555555555'])).toEqual({ ready: true }));
  fireEvent.click(screen.getByRole('button', { name: 'Dettatura Rapida' }));
  const transcript = 'Tavolo per 4 a nome Rossi alle 20:30';
  await waitFor(() => expect(recognition).toBeDefined());
  recognition?.onresult?.({ results: [[{ transcript }]] });
  expect(mocks.parse).not.toHaveBeenCalled();
  await screen.findByRole('textbox');
  fireEvent.click(screen.getByRole('button', { name: /Conferma ed Elabora/ }));
  await waitFor(() => expect(mocks.parse).toHaveBeenCalledWith({ data: {
    restaurant_id: '11111111-2222-4333-8444-555555555555', transcript,
    current_date: '2026-10-22', current_day_name: 'giovedì', agenda_selected_date: '2026-11-10',
  } }));
  await waitFor(() => expect(result).toHaveBeenCalledWith(expect.objectContaining({ date: '2026-11-10', pax: 4, customer_name: 'Rossi' })));
});
const originalDate = Date;