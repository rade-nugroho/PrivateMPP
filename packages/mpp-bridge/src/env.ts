export type LoadedBridgeEnv = {
  secretKey: string;
  tempoRecipient: `0x${string}`;
  tempoCurrency: `0x${string}`;
};

export function loadBridgeEnv(e: NodeJS.ProcessEnv = process.env): LoadedBridgeEnv {
  const secretKey = e.MPP_SECRET_KEY;
  if (!secretKey) {
    throw new Error('MPP_SECRET_KEY is required for mpp-bridge demo wiring');
  }
  const tempoRecipient = (e.MPP_TEMPO_RECIPIENT ?? '0x0000000000000000000000000000000000000000') as `0x${string}`;
  const tempoCurrency = (e.MPP_TEMPO_CURRENCY ??
    '0x20c0000000000000000000000000000000000000') as `0x${string}`;
  return { secretKey, tempoRecipient, tempoCurrency };
}
