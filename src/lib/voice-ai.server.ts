import { voicePrompt, providerError, type AiProvider } from './voice-ai';

/** Chiamata al provider con la chiave del ristorante; restituisce il testo JSON o un errore leggibile. */
export async function callProvider(provider: AiProvider, key: string, transcript: string, currentDate: string, maxTokens = 300): Promise<{ ok: true; text: string } | { ok: false; message: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    if (provider === 'openai') {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST', signal: ctrl.signal, headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'gpt-4o-mini', max_tokens: maxTokens, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: voicePrompt(currentDate) }, { role: 'user', content: transcript }] }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) return { ok: false, message: providerError(res.status, body) };
      return { ok: true, text: body?.choices?.[0]?.message?.content ?? '' };
    }
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
      method: 'POST', signal: ctrl.signal, headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: voicePrompt(currentDate) }] }, contents: [{ role: 'user', parts: [{ text: transcript }] }], generationConfig: { responseMimeType: 'application/json', maxOutputTokens: Math.max(maxTokens, 400), thinkingConfig: { thinkingBudget: 0 } } }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, message: providerError(res.status, body) };
    return { ok: true, text: body?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '' };
  } catch (e) {
    return { ok: false, message: (e as Error).name === 'AbortError' ? 'Il provider non ha risposto in tempo.' : 'Provider IA non raggiungibile.' };
  } finally { clearTimeout(timer); }
}
