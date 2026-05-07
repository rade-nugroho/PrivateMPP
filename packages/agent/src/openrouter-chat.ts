/**
 * OpenRouter chat completions — primary path uses `@openrouter/sdk`; fallback uses `fetch`
 * so offline/name-resolution issues still leave a compiling project.
 *
 * Never log `OPENROUTER_API_KEY` or response bodies containing secrets.
 */

import { OpenRouter } from '@openrouter/sdk';

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export async function chatCompletion(messages: ChatMessage[]): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not set');
  }

  try {
    const client = new OpenRouter({ apiKey });
    const result = await client.chat.send({
      chatRequest: {
        model: process.env.OPENROUTER_MODEL ?? 'openai/gpt-4o-mini',
        messages,
      },
    });
    const raw = result.choices?.[0]?.message?.content;
    if (typeof raw === 'string' && raw.length > 0) {
      return raw;
    }
    if (raw != null) {
      return JSON.stringify(raw);
    }
    return JSON.stringify(result);
  } catch (err) {
    console.warn('[openrouter-chat] SDK path failed, using fetch fallback:', (err as Error).message);
    return chatCompletionFetchFallback(apiKey, messages);
  }
}

async function chatCompletionFetchFallback(apiKey: string, messages: ChatMessage[]): Promise<string> {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
      'http-referer': 'https://local.private-mpp.dev',
      'x-title': 'Private MPP Agent',
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL ?? 'openai/gpt-4o-mini',
      messages,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`OpenRouter HTTP ${res.status}: ${t}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content;
  return typeof text === 'string' ? text : JSON.stringify(data);
}
