import { createFileRoute } from '@tanstack/react-router';
import { authenticateCronRequest } from '@/integrations/supabase/cron-auth';

export const Route = createFileRoute('/api/public/jobs/morning-reminder')({
  server: { handlers: { POST: async ({ request }) => {
    const failure = await authenticateCronRequest(request);
    if (failure) return failure;
    const { sendNextMorningReminder } = await import('@/lib/booking-reminder.server');
    const result = await sendNextMorningReminder();
    const { sendNextDailySummary } = await import('@/lib/service-communications.server');
    const summary = await sendNextDailySummary();
    return Response.json({ ...result, summary });
  } } },
});