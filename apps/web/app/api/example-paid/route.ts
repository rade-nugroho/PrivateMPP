import { Mppx, tempo } from 'mppx/server';

export const dynamic = 'force-dynamic';

/**
 * Dev-only pattern: HTTP 402 challenge → Payment credential → receipt-wrapped JSON.
 * Requires Tempo rail env vars. For PER-specific proofs, see custom methods:
 * https://mpp.dev/payment-methods/custom
 *
 * Without configuration, returns 503 so CI/build environments do not throw at module scope.
 */
function createGate() {
  const secretKey = process.env.MPP_SECRET_KEY;
  const currency = process.env.MPP_TEMPO_CURRENCY;
  const recipient = process.env.MPP_TEMPO_RECIPIENT;
  if (!secretKey || !currency || !recipient) {
    return null;
  }
  return Mppx.create({
    methods: [
      tempo({
        currency: currency as `0x${string}`,
        recipient: recipient as `0x${string}`,
      }),
    ],
    secretKey,
  });
}

export async function GET(request: Request) {
  const gate = createGate();
  if (!gate) {
    return Response.json(
      {
        error: 'example-paid not configured',
        hint: 'Set MPP_SECRET_KEY, MPP_TEMPO_CURRENCY, MPP_TEMPO_RECIPIENT for Tempo-backed 402 demo.',
        customMethodsDoc: 'https://mpp.dev/payment-methods/custom',
      },
      { status: 503 },
    );
  }

  const result = await gate.tempo.charge({ amount: '0.01' })(request);
  if (result.status === 402) {
    return result.challenge;
  }
  return result.withReceipt(
    Response.json({
      ok: true,
      message: 'Paid resource unlocked (development example only).',
    }),
  );
}
