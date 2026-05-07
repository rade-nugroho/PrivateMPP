/**
 * Minimal agent CLI — loads env, runs one tool demo + optional OpenRouter reply.
 *
 * Human approval for large PER transfers: TODO hook before calling `PerPaymentClient.transfer`.
 */

import { createPerClientFromEnv, PerPaymentClient } from '@private-mpp/per-client';
import { chatCompletion } from './openrouter-chat.js';
import { payResource } from './tools/pay-resource.js';

function loadEnv(): void {
  if (!process.env.PER_PRIVATE_PAYMENT_BASE_URL && !process.env.PER_API_BASE) {
    console.warn('[agent] PER_PRIVATE_PAYMENT_BASE_URL / PER_API_BASE not set — PER health skipped.');
  }
}

async function perHealth(per?: PerPaymentClient): Promise<void> {
  if (!per) return;
  try {
    const h = await per.health();
    console.log('[per] /health ->', h.status, JSON.stringify(h.data).slice(0, 500));
  } catch (e) {
    console.warn('[per] health check failed:', (e as Error).message);
  }
}

async function main(): Promise<void> {
  loadEnv();

  let per: PerPaymentClient | undefined;
  try {
    per = createPerClientFromEnv();
  } catch {
    per = undefined;
  }

  await perHealth(per);

  const demoUrl = process.env.AGENT_DEMO_URL ?? 'https://example.com';
  console.log(`[agent] pay_resource probe → ${demoUrl}`);
  const pay = await payResource(demoUrl);
  console.log('[agent] pay_resource result:', pay);

  if (process.env.OPENROUTER_API_KEY) {
    const reply = await chatCompletion([
      {
        role: 'system',
        content:
          'You are a concise assistant helping integrate Private MPP + PER. Summarize the pay_resource result in one short paragraph.',
      },
      { role: 'user', content: JSON.stringify(pay) },
    ]);
    console.log('[openrouter] reply:\n', reply);
  } else {
    console.log('[agent] OPENROUTER_API_KEY not set — skipping chat completion.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
