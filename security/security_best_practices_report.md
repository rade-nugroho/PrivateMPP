# Security best practices review — PrivateMPP

**Scope:** `apps/web`, `packages/*` aligned with OpenAI security best-practices skill references (Next.js server, React, general frontend).  
**Method:** File-level review with line-cited evidence; supplementary awareness of prior static-analysis artifacts (e.g. SARIF under repo root showed no applicable hits for this TS codebase — not reproduced here).

**Reference docs loaded:**

| Pattern | File |
|--------|------|
| Next.js / App Router server | `javascript-typescript-nextjs-web-server-security.md` |
| React | `javascript-typescript-react-web-frontend-security.md` |
| General browser JS | `javascript-general-web-frontend-security.md` |

**Missing from references folder (per glob `*node*`):** no dedicated Node-only sheet — Node/HTTP defaults (SSRF hardening, header hygiene, process env) were applied from the Next.js server spec and common practice.

---

## Stack (evidence)

| Layer | Source |
|-------|--------|
| Monorepo | `pnpm-workspace.yaml` — `packages/*`, `apps/*` |
| Web app | `apps/web/package.json` — **Next.js** `^15.1.6`, **React** `^19`, **TypeScript** `^5.7`, `@modelcontextprotocol/sdk`, `mppx`, workspace `@private-mpp/per-client` |
| Root | Root `package.json` — `pnpm@9.14.4`, TypeScript devDependency |
| Resolved Next (lockfile) | `pnpm-lock.yaml` resolves `next@15.5.18` (meets patched-minor guidance in the Next reference for the 15.5 line when lockfile is honored) |

---

## Executive summary

The repo is a **devnet-first scaffold**: secrets for MPP and OpenRouter stay in server-side `process.env` (no `NEXT_PUBLIC_*` API keys in reviewed code), PER tools use **Zod** for several inputs, and documentation warns against logging bearer material. Gaps are typical for an early scaffold: **`pay_resource` performs outbound `fetch` to URLs that can be influenced by agent/LLM flows with only scheme checks** (SSRF and abuse risk), **no application-level security headers or middleware** appear in the Next app, and **HTTP routes are open without authentication or rate limiting**—acceptable for local demos but not for internet-facing production without edge controls. Upgrade discipline should keep `next` on patched minors per advisories.

---

## Findings by severity

### Critical

*None identified in reviewed code paths (no committed secrets, no `eval` of user input, no obvious auth bypass in code present).*

### High

#### SEC-001 — Agent `pay_resource`: user/LLM-influenced URL fetch without network-level restrictions (SSRF-style abuse)

**Impact:** A compromised prompt, malicious tool argument, or autonomous agent could direct the server to request **internal IPs**, **cloud metadata URLs**, or **third-party endpoints** (traffic amplification, data exfil if responses are logged/shown). Protocol-only checks do not satisfy **NEXT-SSRF-001** / defense-in-depth for server-side fetch.

**Evidence:**

```15:40:packages/agent/src/tools/pay-resource.ts
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
    // ...
```

**Related guidance already in repo (not enforced in `pay-resource.ts`):**

```4:6:packages/agent/src/tools.ts
/** Never pass arbitrary URLs from the LLM to fetch — allowlist hosts in production brokers */
export const ALLOWLIST_NOTE =
  'Production agents must validate payout URLs and RPC endpoints against an explicit allowlist; do not fetch user-supplied URLs.';
```

**Recommendation:** Allowlist hostnames (and optionally paths), block link-local/private ranges, enforce timeouts, limit redirects; or disable `pay_resource` outside dev.

---

### Medium

#### SEC-002 — No centralized security headers (CSP, `X-Content-Type-Options`, `Referrer-Policy`, frame protections)

**Impact:** Missing defense-in-depth against XSS and clickjacking if the app later renders untrusted content or adds scripts; headers may exist only at a hoster/CDN not visible in-repo—**verify at deploy**.

**Evidence:** `next.config.ts` only transpiles workspace packages—no `headers()` equivalent or security header map:

```3:7:apps/web/next.config.ts
const nextConfig: NextConfig = {
  transpilePackages: ['@private-mpp/per-client'],
};

export default nextConfig;
```

No `middleware.ts` / `proxy.ts` found under `apps/web`.

---

#### SEC-003 — Public, unauthenticated API routes (payment demo, PER health proxy, local health)

**Impact:** Anyone who can reach the deployment can trigger **`/api/example-paid`** (MPP payment flow behavior) and **`/api/per-proxy/health`** (backend-to-PER traffic), enabling **abuse, operational cost**, or **fingerprinting** of infrastructure. Appropriate for local dev; **not** a production posture without authn/rate limits.

**Evidence:**

```30:52:apps/web/app/api/example-paid/route.ts
export async function GET(request: Request) {
  const gate = createGate();
  // ...
  const result = await gate.tempo.charge({ amount: '0.01' })(request);
```

```10:27:apps/web/app/api/per-proxy/health/route.ts
export async function GET() {
  const base = perBaseUrlFromEnv(process.env);
  // ...
  const r = await client.health();
  return NextResponse.json(
    { proxied: true, perStatus: r.status, body: r.data, parsed: r.parsed },
```

---

#### SEC-004 — PER health proxy returns raw upstream JSON (`body`) to the caller

**Impact:** If the upstream PER deployment ever includes **non-public fields** in `/health`, this route **amplifies disclosure** to any client that can call the Next app.

**Evidence:**

```22:26:apps/web/app/api/per-proxy/health/route.ts
  const client = new PerPaymentClient({ baseUrl: base });
  const r = await client.health();
  return NextResponse.json(
    { proxied: true, perStatus: r.status, body: r.data, parsed: r.parsed },
```

---

#### SEC-005 — Payment-gated resource exposed as **GET** `/api/example-paid`

**Impact:** For cookie-based or browser-session payment flows, **GET** can complicate **CSRF** and caching semantics (**NEXT-CSRF-001**, **NEXT-CACHE-001**). If this endpoint only uses non-cookie mechanisms, risk is lower—**confirm** against `mppx` behavior.

**Evidence:** Same as SEC-003 — `GET` handler in `example-paid/route.ts` (see lines 30–52 cited above).

---

### Low

#### SEC-006 — Dependency range vs lockfile for `next`

**Impact:** `apps/web/package.json` allows `^15.1.6`; **current** `pnpm-lock.yaml` resolves **`next@15.5.18`** (patched line). Future installs without lockfile discipline could resolve an older vulnerable minor. **Pin or CI-guard** supported minors per [Next.js security advisories](https://nextjs.org/blog).

**Evidence:**

```11:17:apps/web/package.json
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.25.0",
    "@private-mpp/per-client": "workspace:*",
    "mppx": "^0.6.16",
    "next": "^15.1.6",
```

```831:831:pnpm-lock.yaml
  next@15.5.18:
```

---

#### SEC-007 — CLI logs PER health response snippet to stdout

**Impact:** Operational **information disclosure** if `/health` ever returns sensitive diagnostics (unlikely for `{ status: 'ok' }` but environment-dependent).

**Evidence:**

```17:21:packages/agent/src/cli.ts
async function perHealth(per?: PerPaymentClient): Promise<void> {
  if (!per) return;
  try {
    const h = await per.health();
    console.log('[per] /health ->', h.status, JSON.stringify(h.data).slice(0, 500));
```

---

#### SEC-008 — OpenRouter fallback path logs SDK error message

**Impact:** Low—could aid debugging in shared logs; ensure production logging **redacts** tokens (comment already warns against logging secrets).

**Evidence:**

```34:36:packages/agent/src/openrouter-chat.ts
  } catch (err) {
    console.warn('[openrouter-chat] SDK path failed, using fetch fallback:', (err as Error).message);
    return chatCompletionFetchFallback(apiKey, messages);
```

---

## Positive practices observed

- **Server-only LLM key:** `OPENROUTER_API_KEY` read in Node/agent code, not exposed via `NEXT_PUBLIC_*` in reviewed sources (`packages/agent/src/openrouter-chat.ts`, `packages/agent/src/agent.ts`).
- **Runtime validation:** PER agent tools use **Zod** (`packages/agent/src/tools.ts`) for balance/deposit shapes.
- **Client boundary:** No `"use client"` usage found—reduces accidental secret bundling for current UI.
- **Explicit security comments:** e.g. PER client and OpenRouter modules warn against logging tokens (`packages/per-client/src/client.ts` header comment; `packages/agent/src/openrouter-chat.ts`).

---

## Prior automated scans

SARIF files under `security/reports/` (`results-*.sarif`) are **not** duplicated here; they appeared oriented to other rule packs with **empty or non-applicable results** for this TypeScript tree. Treat ongoing **pnpm audit / Dependabot / advisory feeds** as the source of truth for dependency CVEs.

---

## Recommended next steps (non-code; operational)

1. Enforce **allowlisted outbound URLs** for any agent-driven fetch (SEC-001).
2. Add **security headers** at Next config, middleware, or edge (SEC-002).
3. Protect or rate-limit **public APIs** before wide deployment (SEC-003–SEC-005).
4. Keep **`next`** and React on **patched minors** via lockfile + CI (SEC-006).
