import { z } from 'zod';
import type { PerPaymentClient } from '@private-mpp/per-client';

/** Never pass arbitrary URLs from the LLM to fetch — allowlist hosts in production brokers */
export const ALLOWLIST_NOTE =
  'Production agents must validate payout URLs and RPC endpoints against an explicit allowlist; do not fetch user-supplied URLs.';

const DepositBodySchema = z
  .object({
    /** TODO: align fields with PER POST /v1/spl/deposit OpenAPI when wiring signing */
    payload: z.record(z.unknown()).optional(),
  })
  .strict();

const BalanceQuerySchema = z.object({
  address: z.string().min(32).max(48),
  mint: z.string().min(32).max(48),
  cluster: z.enum(['mainnet', 'devnet']).optional(),
});

export type AgentToolResult =
  | { ok: true; data: unknown }
  | { ok: false; error: string };

export function createPerTools(per: PerPaymentClient) {
  return {
    name: 'per-private-payment',
    tools: [
      {
        type: 'function' as const,
        function: {
          name: 'per_health',
          description: 'Check Private Payments API health (GET /health).',
          parameters: {
            type: 'object',
            properties: {},
          },
        },
        invoke: async (): Promise<AgentToolResult> => {
          const r = await per.health();
          if (!r.ok) return { ok: false, error: `PER health failed (HTTP ${r.status})` };
          return { ok: true, data: r.data };
        },
      },
      {
        type: 'function' as const,
        function: {
          name: 'per_balance',
          description: 'Read base-chain SPL balance via PER (GET /v1/spl/balance).',
          parameters: {
            type: 'object',
            properties: {
              address: { type: 'string', description: 'Owner wallet pubkey' },
              mint: { type: 'string', description: 'SPL mint pubkey' },
              cluster: { type: 'string', enum: ['mainnet', 'devnet'] },
            },
            required: ['address', 'mint'],
          },
        },
        invoke: async (args: unknown): Promise<AgentToolResult> => {
          const p = BalanceQuerySchema.safeParse(args);
          if (!p.success) return { ok: false, error: p.error.message };
          const r = await per.balance(p.data);
          if (!r.ok) return { ok: false, error: `PER balance failed (HTTP ${r.status})` };
          return { ok: true, data: r.data };
        },
      },
      {
        type: 'function' as const,
        function: {
          name: 'per_deposit',
          description:
            'Request deposit transaction build from PER (POST /v1/spl/deposit). Body schema TBD from OpenAPI.',
          parameters: {
            type: 'object',
            properties: {
              payload: { type: 'object', description: 'Opaque JSON per PER docs' },
            },
          },
        },
        invoke: async (args: unknown): Promise<AgentToolResult> => {
          const p = DepositBodySchema.safeParse(args);
          if (!p.success) return { ok: false, error: p.error.message };
          const body = p.data.payload ?? {};
          const r = await per.deposit(body as Record<string, unknown>);
          if (!r.ok) return { ok: false, error: `PER deposit failed (HTTP ${r.status})` };
          return { ok: true, data: r.data };
        },
      },
    ],
  };
}
