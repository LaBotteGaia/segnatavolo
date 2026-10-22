import { afterEach, expect, it, vi } from 'vitest';
import { callProvider } from '@/lib/voice-ai.server';
import { voicePrompt } from '@/lib/voice-ai';

afterEach(() => vi.unstubAllGlobals());
it.each(['openai', 'gemini'] as const)('%s riceve lo stesso contesto temporale completo', async (provider) => {
  const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: '{}' } }], candidates: [{ content: { parts: [{ text: '{}' }] } }] })));
  vi.stubGlobal('fetch', request);
  const ctx = { current_date: '2026-10-22', current_day_name: 'giovedì', agenda_selected_date: '2026-11-10' };
  await callProvider(provider, 'test-only-not-a-real-key', 'Tavolo per 4', ctx.current_date, 300, ctx);
  const call = request.mock.calls[0];
  if (!call) throw new Error('Provider non chiamato');
  const body = JSON.parse(call[1].body);
  const actualPrompt = provider === 'openai' ? body.messages[0].content : body.systemInstruction.parts[0].text;
  expect(actualPrompt).toBe(voicePrompt(ctx.current_date, ctx));
});