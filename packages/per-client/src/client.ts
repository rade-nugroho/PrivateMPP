/**
 * Typed HTTP client for MagicBlock Private Payments API (PER).
 * Paths align with public docs; validate responses with Zod where shapes are stable.
 *
 * Security: never log bearer tokens, signatures, or challenge material in agent/tool code.
 */

import { PER_API_PATHS } from './paths.js';
import {
  tryParseHealth,
  tryParseSplBalance,
  type PerHealthResponse,
  type PerSplBalanceResponse,
} from './schemas.js';

export type PerPaymentClientOptions = {
  /** Base URL (no trailing slash). Example placeholder for docs-only runs: https://api.example.invalid */
  baseUrl: string;
  fetch?: typeof fetch;
  defaultHeaders?: Record<string, string>;
};

export type JsonRecord = Record<string, unknown>;

export type PerClientResult<T = JsonRecord | unknown> = {
  ok: boolean;
  status: number;
  data: T;
  /** Populated when JSON matches known PER schemas */
  parsed?: {
    health?: PerHealthResponse;
    splBalance?: PerSplBalanceResponse;
  };
};

async function parseJsonSafe(res: Response): Promise<JsonRecord | unknown> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as JsonRecord;
  } catch {
    return { raw: text };
  }
}

export type SplBalanceQuery = {
  address: string;
  mint: string;
  /** mainnet | devnet | custom base RPC URL */
  cluster?: string;
};

function qs(params: Record<string, string | undefined>): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') u.set(k, v);
  }
  const s = u.toString();
  return s ? `?${s}` : '';
}

export class PerPaymentClient {
  private readonly base: string;
  private readonly fetchImpl: typeof fetch;
  private readonly defaultHeaders: Record<string, string>;

  constructor(opts: PerPaymentClientOptions) {
    this.base = opts.baseUrl.replace(/\/+$/, '');
    this.fetchImpl = opts.fetch ?? globalThis.fetch.bind(globalThis);
    this.defaultHeaders = opts.defaultHeaders ?? {};
  }

  private url(path: string, query?: string): string {
    const p = path.startsWith('/') ? path : `/${path}`;
    return `${this.base}${p}${query ?? ''}`;
  }

  private enrichParsed(data: unknown): PerClientResult['parsed'] {
    const parsed: PerClientResult['parsed'] = {};
    const h = tryParseHealth(data);
    if (h) parsed.health = h;
    const b = tryParseSplBalance(data);
    if (b) parsed.splBalance = b;
    return Object.keys(parsed).length ? parsed : undefined;
  }

  private async request(
    method: string,
    pathWithQuery: string,
    body?: unknown,
    headers?: Record<string, string>,
  ): Promise<PerClientResult> {
    const res = await this.fetchImpl(this.url(pathWithQuery), {
      method,
      headers: {
        'content-type': 'application/json',
        ...this.defaultHeaders,
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await parseJsonSafe(res);
    return {
      ok: res.ok,
      status: res.status,
      data,
      parsed: this.enrichParsed(data),
    };
  }

  /** GET /health */
  health() {
    return this.request('GET', PER_API_PATHS.health);
  }

  /** GET /v1/spl/challenge?pubkey= */
  challenge(pubkey: string) {
    const q = qs({ pubkey });
    return this.request('GET', `${PER_API_PATHS.challenge}${q}`);
  }

  /** POST /v1/spl/login — body typically { pubkey, challenge, signature } */
  login(body: JsonRecord) {
    return this.request('POST', PER_API_PATHS.login, body);
  }

  /** POST /v1/spl/deposit */
  deposit(body: JsonRecord) {
    return this.request('POST', PER_API_PATHS.deposit, body);
  }

  /** POST /v1/spl/transfer — bearer optional depending on flow */
  transfer(body: JsonRecord, opts?: { bearerToken?: string }) {
    const h = opts?.bearerToken
      ? { Authorization: `Bearer ${opts.bearerToken}` }
      : undefined;
    return this.request('POST', PER_API_PATHS.transfer, body, h);
  }

  /** POST /v1/spl/withdraw */
  withdraw(body: JsonRecord) {
    return this.request('POST', PER_API_PATHS.withdraw, body);
  }

  /** GET /v1/spl/balance */
  balance(query: SplBalanceQuery) {
    const q = qs({
      address: query.address,
      mint: query.mint,
      cluster: query.cluster,
    });
    return this.request('GET', `${PER_API_PATHS.balance}${q}`);
  }

  /** GET /v1/spl/private-balance — requires Bearer from login */
  privateBalance(query: SplBalanceQuery, bearerToken: string) {
    const q = qs({
      address: query.address,
      mint: query.mint,
      cluster: query.cluster,
    });
    return this.request('GET', `${PER_API_PATHS.privateBalance}${q}`, undefined, {
      Authorization: `Bearer ${bearerToken}`,
    });
  }

  /** POST /v1/spl/initialize-mint */
  initializeMint(body: JsonRecord) {
    return this.request('POST', PER_API_PATHS.initializeMint, body);
  }

  /** GET /v1/spl/is-mint-initialized */
  isMintInitialized(query: { mint: string; cluster?: string }) {
    const q = qs({ mint: query.mint, cluster: query.cluster });
    return this.request('GET', `${PER_API_PATHS.isMintInitialized}${q}`);
  }

  /** POST /v1/spl/quote */
  quote(body: JsonRecord) {
    return this.request('POST', PER_API_PATHS.quote, body);
  }

  /** POST /v1/spl/swap */
  swap(body: JsonRecord, opts?: { bearerToken?: string }) {
    const h = opts?.bearerToken
      ? { Authorization: `Bearer ${opts.bearerToken}` }
      : undefined;
    return this.request('POST', PER_API_PATHS.swap, body, h);
  }

  /** POST /mcp — JSON-RPC envelope per MCP HTTP mapping */
  mcp(body: JsonRecord) {
    return this.request('POST', PER_API_PATHS.mcp, body);
  }
}

const ENV_KEYS = ['PER_PRIVATE_PAYMENT_BASE_URL', 'PER_API_BASE'] as const;

/** Resolve base URL from env (first defined wins). */
export function perBaseUrlFromEnv(env: NodeJS.ProcessEnv = process.env): string | undefined {
  for (const k of ENV_KEYS) {
    const v = env[k];
    if (v && v.trim()) return v.trim();
  }
  return undefined;
}

export function createPerClientFromEnv(env: NodeJS.ProcessEnv = process.env): PerPaymentClient {
  const base = perBaseUrlFromEnv(env);
  if (!base) {
    throw new Error(
      `Set ${ENV_KEYS.join(' or ')} to create PerPaymentClient (e.g. https://api.example.invalid for docs-only).`,
    );
  }
  return new PerPaymentClient({ baseUrl: base });
}
