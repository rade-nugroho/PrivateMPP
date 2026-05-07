/**
 * Custom payment method — bridging PER settlements into MPP credential shape (stubs only).
 *
 * https://mpp.dev/payment-methods/custom
 *
 * Production wiring must register a server method compatible with `mppx/server`, and map
 * Payment HTTP challenges/credentials to PER flows using audited crypto — not invented here.
 */

import type { JsonRecord } from './client.js';

export type PerSettlementProof = {
  kind: 'per-settlement-v0';
  reference: string;
  metadata?: JsonRecord;
};

export type PerBackedCredentialPayload = {
  proof: PerSettlementProof;
  scope?: string;
};

/** Stub: verify PER settlement proof (replace with MPP.verifyCredential + PER receipts). */
export async function verifyPerBackedCredentialStub(
  _payload: PerBackedCredentialPayload,
): Promise<boolean> {
  return false;
}
