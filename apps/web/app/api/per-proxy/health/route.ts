import { NextResponse } from 'next/server';
import { PerPaymentClient, perBaseUrlFromEnv } from '@private-mpp/per-client';

export const dynamic = 'force-dynamic';

/**
 * Proxies GET /health to the configured PER base URL for quick wiring checks.
 * Do not forward secrets; health responses should be non-sensitive.
 */
export async function GET() {
  const base = perBaseUrlFromEnv(process.env);
  if (!base) {
    return NextResponse.json(
      {
        error: 'PER_PRIVATE_PAYMENT_BASE_URL or PER_API_BASE not configured',
        hint: 'Set env to your devnet PER deployment (see README).',
      },
      { status: 503 },
    );
  }

  const client = new PerPaymentClient({ baseUrl: base });
  const r = await client.health();
  return NextResponse.json(
    { proxied: true, perStatus: r.status, body: r.data, parsed: r.parsed },
    { status: r.ok ? 200 : r.status },
  );
}
