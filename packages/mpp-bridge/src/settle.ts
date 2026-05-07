/**
 * Integration seam: after MPP credential verification succeeds, settle or reconcile via PER.
 */

import type { PerPaymentClient } from '@private-mpp/per-client';

export type SettleWithPerInput = {
  transferBody?: Record<string, unknown>;
};

export async function settleAfterVerifiedCredential(
  per: PerPaymentClient,
  input: SettleWithPerInput,
): Promise<{ ok: boolean; status: number; data: unknown }> {
  void input;
  const res = await per.transfer({});
  return { ok: res.ok, status: res.status, data: res.data };
}
