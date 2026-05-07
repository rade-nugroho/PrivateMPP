/**
 * Vertical slice: HTTP handler — `402` challenge via `mppx.compose`, then receipt.
 * Demo intent: `tempo/charge`.
 */

export type MppxComposeHandler = {
  compose: (
    ...entries: unknown[]
  ) => (input: Request) => Promise<{
    status: number;
    challenge: Response;
    withReceipt: (r: Response) => Response;
  }>;
};

export function createPaidResourceHandler(mppx: MppxComposeHandler) {
  return async (request: Request): Promise<Response> => {
    const result = await mppx.compose(['tempo/charge', { amount: '1' }])(request);

    if (result.status === 402) {
      return result.challenge;
    }

    return result.withReceipt(
      new Response(JSON.stringify({ ok: true, resource: 'paid-placeholder' }), {
        headers: { 'content-type': 'application/json' },
      }),
    );
  };
}
