# PrivateMPP — Threat Model (repository-grounded)

**Scope:** Monorepo root `/Users/macbook/PrivateMPP` — `apps/web` (Next.js App Router), `packages/agent` (CLI + OpenRouter), `packages/per-client`, `packages/mpp-bridge`, example API routes.  
**Out of scope:** External MagicBlock PER/OpenRouter/Tempo services beyond integration contracts; CI (no `.github/workflows` present in repo).

---

## 1. System model (evidence)

| Component | Role | Evidence |
|-----------|------|----------|
| Next.js web app | HTTP API routes, server-side env | `apps/web/app/api/**/route.ts`, `apps/web/package.json` |
| PER HTTP client | Typed calls to configured base URL | `packages/per-client/src/client.ts` |
| Agent library + CLI | OpenRouter chat + PER tools; demo `pay_resource` fetch | `packages/agent/src/agent.ts`, `packages/agent/src/cli.ts`, `packages/agent/src/tools.ts`, `packages/agent/src/tools/pay-resource.ts` |
| Tempo / MPP (mppx) | HTTP 402 gate for `example-paid` | `apps/web/app/api/example-paid/route.ts`, `packages/mpp-bridge/src/env.ts` |

No `middleware.ts` in `apps/web` — no repo-level auth gate on routes (`Glob` search).

---

## 2. Trust boundaries

| Boundary | Protocol | Notes |
|----------|----------|--------|
| Browser / client → Next.js route handlers | HTTPS (deployment-dependent) | Routes are server-side; no cookie/session auth in repo |
| Next.js → PER backend | HTTPS `fetch` to `PER_PRIVATE_PAYMENT_BASE_URL` / `PER_API_BASE` | No mTLS or extra headers in default client (`packages/per-client/src/client.ts`) |
| Next.js → Tempo (via mppx) | Library-mediated payment challenge | Secret `MPP_SECRET_KEY` (`apps/web/app/api/example-paid/route.ts`) |
| Operator shell → CLI | Local env (`OPENROUTER_*`, `PER_*`) | `packages/agent/src/cli.ts`, `packages/agent/src/openrouter-chat.ts` |
| OpenRouter API ↔ Agent | HTTPS + bearer API key | `packages/agent/src/openrouter-chat.ts` |

---

## 3. Assets

| Asset | Sensitivity | Evidence |
|-------|-------------|----------|
| `OPENROUTER_API_KEY` | High — API abuse, quota theft | `packages/agent/src/agent.ts`, `packages/agent/src/openrouter-chat.ts`; `.env.example` documents |
| `MPP_SECRET_KEY` | High — forged receipts / payment verification bypass if disclosed | `apps/web/app/api/example-paid/route.ts`, `packages/mpp-bridge/src/env.ts`, `.env.example` |
| PER base URL + PER responses | Medium — infra fingerprinting; body echoed on proxy route | `apps/web/app/api/per-proxy/health/route.ts` |
| Tempo recipient/currency | Medium — misdirection of payments if tampered | `.env.example`, `example-paid/route.ts` |
| SPL deposit payloads via `per_deposit` tool | Integrity / funds movement — depends on PER validation | `packages/agent/src/tools.ts` |

---

## 4. Entry points

| Entry point | Auth in repo | Evidence |
|-------------|----------------|----------|
| `GET /api/local-health` | None | `apps/web/app/api/local-health/route.ts` |
| `GET /api/per-proxy/health` | None — proxies PER `/health` | `apps/web/app/api/per-proxy/health/route.ts` |
| `GET /api/example-paid` | None — Tempo gate uses server secret | `apps/web/app/api/example-paid/route.ts` |
| Agent CLI (`pnpm agent:dev`) | Env-only | `packages/agent/src/cli.ts` |
| `PrivateMppAgent.chat()` + tools | No RBAC/HITL in code | `packages/agent/src/agent.ts` |

---

## 5. Abuse paths (prioritized)

### AP1 — Prompt injection → unintended tool execution (agent)

**Path:** Untrusted text → `PrivateMppAgent.chat()` → model invokes `per_health` / `per_balance` / `per_deposit` with model-chosen arguments.

**Impact:** Depends on PER server authorization on `deposit` and chain semantics; could cause unwanted deposit requests or operational confusion.

**Existing mitigation:** Zod validation on tool args (`packages/agent/src/tools.ts`); comment warning to sandbox untrusted input (`packages/agent/src/agent.ts`).

**Recommended:** Human-in-the-loop or policy layer before state-changing tools; disable tools for anonymous chat; rate limits.

**Likelihood:** Medium if chat is ever exposed to end users with secrets configured. **Impact:** Medium–High (conditional on PER). **Priority:** High for production chat UX.

---

### AP2 — Dependency vulnerability (PostCSS via Next)

**Path:** Build/toolchain processes CSS through vulnerable PostCSS stringify (transitive `next` → `postcss`).

**Impact:** XSS when untrusted CSS is parsed and embedded in `<style>` per advisory conditions.

**Existing mitigation:** None in-repo; relies on Next/postcss upstream.

**Recommended:** Track Next/postcss upgrades (`pnpm audit` flagged moderate GHSA-qx2v-qp2m-jg93).

**Likelihood:** Low–Medium for typical Next usage without embedding attacker CSS. **Impact:** Medium under advisory preconditions.

---

### AP3 — Information disclosure via PER health proxy

**Path:** Unauthenticated caller → `/api/per-proxy/health` → JSON includes `body: r.data` from PER.

**Impact:** If PER `/health` ever returns sensitive operational fields, they leak to anyone who can reach the route.

**Existing mitigation:** Comment states non-sensitive expectation (`apps/web/app/api/per-proxy/health/route.ts`).

**Recommended:** Redact or schema-whitelist health JSON before forwarding if PER evolves.

---

### AP4 — `pay_resource` SSRF-style fetch (CLI demo)

**Path:** `payResource(url)` fetches arbitrary HTTP(S) URL (`packages/agent/src/tools/pay-resource.ts`). CLI uses `AGENT_DEMO_URL` default `https://example.com` (`packages/agent/src/cli.ts`).

**Impact:** If future code passes model-controlled URLs into `payResource`, SSRF to internal networks becomes plausible.

**Existing mitigation:** Protocol check; `ALLOWLIST_NOTE` in `packages/agent/src/tools.ts` for production brokers.

**Recommended:** Host allowlist before any LLM-driven fetch.

---

## 6. STRIDE (abbreviated)

| Threat | Web app | Agent CLI |
|--------|---------|-----------|
| Spoofing | Low — no user auth in repo | API key in env — protect operator machine |
| Tampering | Medium — deposit payloads via tools hit PER | Same via tools |
| Repudiation | No audit logging in-repo | Console logs only |
| Information disclosure | PER proxy echoes PER body | Chat may log warnings; docs say do not log API keys (`openrouter-chat.ts`) |
| Denial of service | Public routes callable — no rate limits in repo | Repeated OpenRouter/PER calls possible |
| Elevation | N/A — no roles defined | N/A |

---

## 7. Assumptions

1. Deployment exposes Next routes to the internet unless otherwise restricted (VPC, edge auth not in repo).
2. PER devnet/mainnet endpoints enforce authorization on money-moving endpoints; client only sends HTTP requests.
3. OpenRouter agent chat is primarily for operator/integration testing, not multi-tenant end users, unless product direction changes.

---

## 8. Questions for the product owner

1. **Exposure:** Will `apps/web` API routes remain publicly reachable without authentication, or will you add edge/auth middleware before production traffic?

2. **Agent UX:** Is `PrivateMppAgent.chat()` intended for untrusted end-user messages in production? If yes, what approval policy applies before `per_deposit` or similar tools execute?

3. **PER trust:** What guarantees does your deployed PER instance provide on `/v1/spl/deposit` for arbitrary JSON bodies from the agent tools?
