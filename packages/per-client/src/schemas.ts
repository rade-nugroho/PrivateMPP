import { z } from 'zod';

/** GET /health — see PER OpenAPI health schema */
export const PerHealthResponseSchema = z.object({
  status: z.literal('ok'),
});
export type PerHealthResponse = z.infer<typeof PerHealthResponseSchema>;

/** GET /v1/spl/balance and /v1/spl/private-balance success bodies */
export const PerSplBalanceResponseSchema = z.object({
  address: z.string(),
  mint: z.string(),
  ata: z.string(),
  location: z.enum(['base', 'ephemeral']),
  balance: z.string(),
});
export type PerSplBalanceResponse = z.infer<typeof PerSplBalanceResponseSchema>;

/** Common transaction-build envelope from POST endpoints that return unsigned txs */
export const PerUnsignedTxEnvelopeSchema = z
  .object({
    kind: z.string().optional(),
    version: z.string().optional(),
    transactionBase64: z.string().optional(),
    sendTo: z.enum(['base', 'ephemeral']).optional(),
    recentBlockhash: z.string().optional(),
    lastValidBlockHeight: z.number().optional(),
    instructionCount: z.number().optional(),
    requiredSigners: z.array(z.string()).optional(),
  })
  .passthrough();
export type PerUnsignedTxEnvelope = z.infer<typeof PerUnsignedTxEnvelopeSchema>;

/** Safe parse helpers — return validated data or undefined without throwing */
export function tryParseHealth(data: unknown): PerHealthResponse | undefined {
  const r = PerHealthResponseSchema.safeParse(data);
  return r.success ? r.data : undefined;
}

export function tryParseSplBalance(data: unknown): PerSplBalanceResponse | undefined {
  const r = PerSplBalanceResponseSchema.safeParse(data);
  return r.success ? r.data : undefined;
}
