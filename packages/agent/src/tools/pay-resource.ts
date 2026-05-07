/**
 * Tool: fetch a URL that may return HTTP 402 (MPP). Agents must treat URLs as untrusted (OWASP LLM).
 *
 * Full automatic settlement requires a configured `mppx/client` wallet rail — not enabled by default
 * to avoid shipping signing keys. This implementation performs a **probe fetch** and surfaces 402 metadata.
 */

export type PayResourceResult =
  | { status: 'ok'; httpStatus: number; snippet: string }
  | { status: 'payment_required'; httpStatus: 402; note: string }
  | { status: 'error'; message: string };

const MAX_SNIPPET = 4000;

export async function payResource(url: string): Promise<PayResourceResult> {
  try {
    const u = new URL(url);
    if (!['http:', 'https:'].includes(u.protocol)) {
      return { status: 'error', message: 'Only http(s) URLs are allowed for pay_resource' };
    }
  } catch {
    return { status: 'error', message: 'Invalid URL' };
  }

  try {
    const res = await fetch(url, { redirect: 'manual' });
    if (res.status === 402) {
      return {
        status: 'payment_required',
        httpStatus: 402,
        note:
          'Resource requires payment (HTTP 402). Wire `mppx/client` with an approved payment method to complete the challenge→credential→receipt loop; see docs/architecture-low-level.md.',
      };
    }
    const text = await res.text();
    const snippet = text.slice(0, MAX_SNIPPET);
    return { status: 'ok', httpStatus: res.status, snippet };
  } catch (e) {
    return { status: 'error', message: (e as Error).message };
  }
}
