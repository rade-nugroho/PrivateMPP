/**
 * Server-side `mppx/server` wiring sketch (Tempo demo rail — not PER).
 */

import { Mppx, tempo } from 'mppx/server';

export type TempoDemoEnv = {
  secretKey: string;
  realm?: string;
  tempoRecipient: `0x${string}`;
  tempoCurrency: `0x${string}`;
};

/** Build an `mppx` instance with the stock Tempo `charge` method (demo rail, not PER). */
export function createTempoDemoMppx(env: TempoDemoEnv): unknown {
  const methods = [
    tempo({
      currency: env.tempoCurrency,
      recipient: env.tempoRecipient,
    }),
  ];

  return Mppx.create({
    secretKey: env.secretKey,
    realm: env.realm ?? 'private-mpp.local',
    methods,
  }) as unknown;
}
