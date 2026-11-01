import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), send: vi.fn(), update: vi.fn(), eq: vi.fn() }));
vi.mock('@/integrations/supabase/client.server', () => ({ supabaseAdmin: { rpc: mocks.rpc, from: mocks.from } }));
vi.mock('@/lib/restaurant-email.server', () => ({ sendRestaurantMessage: mocks.send }));
import { sendNextMorningReminder } from '@/lib/booking-reminder.server';

const booking = { id: '123e4567-e89b-42d3-a456-426614174000', restaurant_id: '123e4567-e89b-42d3-a456-426614174001', restaurant: 'Locale', email: 'cliente@example.com', date: '2026-11-02', time: '12:00', shift: 'pranzo', people: 2, token: '123e4567-e89b-42d3-a456-426614174002', whatsapp: '' };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.from.mockReturnValue({ update: mocks.update });
  mocks.update.mockReturnValue({ eq: mocks.eq });
  mocks.eq.mockReturnValue({ eq: mocks.eq, error: null });
});
describe('promemoria indipendente', () => {
  it('invia a un solo destinatario derivato dalla prenotazione e registra successo', async () => {
    mocks.rpc.mockResolvedValue({ data: booking, error: null }); mocks.send.mockResolvedValue({ sent: true });
    expect(await sendNextMorningReminder()).toEqual({ processed: true, sent: true });
    expect(mocks.send).toHaveBeenCalledTimes(1);
    expect(mocks.send.mock.calls[0]?.slice(0, 2)).toEqual([booking.restaurant_id, booking.email]);
    expect(mocks.update.mock.calls[0]?.[0].morning_reminder_sent_at).toEqual(expect.any(String));
  });
  it('non invia di nuovo quando la presa atomica non trova una prenotazione', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    expect(await sendNextMorningReminder()).toEqual({ processed: false }); expect(mocks.send).not.toHaveBeenCalled();
  });
  it('registra mancato invio senza cambiare approvazione o riconferma', async () => {
    mocks.rpc.mockResolvedValue({ data: booking, error: null }); mocks.send.mockResolvedValue({ sent: false, message: 'SMTP non disponibile' });
    await sendNextMorningReminder();
    expect(mocks.update).toHaveBeenCalledWith({ morning_reminder_sent_at: null, morning_reminder_error: 'SMTP non disponibile' });
  });
});