# PrivateMPP — CSO-style Security Report

**Date:** 2026-05-08  
**Mode:** Daily (8/10 confidence gate for primary findings)  
**Workspace:** `/Users/macbook/PrivateMPP`

---

## Executive summary

Monorepo: Next.js 15 web (`apps/web`), PER client (`packages/per-client`), agent + OpenRouter (`packages/agent`). No GitHub Actions workflows in repo. **pnpm audit:** 0 critical, 0 high, **1 moderate** (PostCSS transitive via Next). No hardcoded live API keys detected in source (grep). Primary risks above the confidence gate: **(1)** transitive PostCSS advisory, **(2)** LLM tool-calling surface without in-repo authorization/HITL when `PrivateMppAgent.chat()` is used with secrets configured. **Customer escalation:** not applicable (no customer-facing incident).

---

## Phase 0 — Inventory

| Artifact | Result |
|----------|--------|
| Root `package.json` | Workspace scripts only; `pnpm@9.14.4` (`package.json`) |
| `pnpm-workspace.yaml` | `packages/*`, `apps/*` |
| `.env.example` | Documents PER URL, `MPP_*`, Tempo fields, `OPENROUTER_*`, `SOLANA_NETWORK` |
| `.github/workflows/*` | **Absent** — `.github` directory does not exist |

---

## Phase 1 — Attack surface

### Next.js API routes (`apps/web/app/api`)

| Route | Behavior |
|-------|----------|
| `example-paid/route.ts` | Tempo/Mppx gate; requires `MPP_SECRET_KEY`, `MPP_TEMPO_*` or returns 503 |
| `per-proxy/health/route.ts` | Server-side `fetch` to PER `/health`; returns proxied JSON |
| `local-health/route.ts` | Static OK JSON — no upstream |

### Agent CLI (`packages/agent`)

- `cli.ts`: PER health, `payResource(AGENT_DEMO_URL)`, optional OpenRouter completion.
- `tools.ts`: `per_health`, `per_balance`, `per_deposit` exposed as OpenRouter tool definitions when using `chat()`.
- `pay-resource.ts`: HTTP(S) fetch probe — documented SSRF caution for future LLM wiring.

### Env usage (`process.env`)

Referenced in: `apps/web/app/api/example-paid/route.ts`, `apps/web/app/api/per-proxy/health/route.ts`, `packages/agent/src/agent.ts`, `packages/agent/src/cli.ts`, `packages/agent/src/openrouter-chat.ts`, `packages/per-client/src/client.ts` (`perBaseUrlFromEnv`), `packages/mpp-bridge/src/env.ts`.

---

## Phase 2 — Secrets archaeology

Patterns searched (repo TS/JS/JSON): long `sk-`, inline API keys, hex private keys. **No matches** in application source (placeholders confined to `.env.example` per exclusion policy).

**Residual risks:** operational — real secrets must never be committed; `.env.example` correctly uses placeholders.

---

## Phase 3 — Dependency audit

**Command:** `pnpm audit`  
**Counts:** critical **0**, high **0**, moderate **1**, low **0** (metadata from audit JSON).

**Moderate:** `postcss@8.4.31` via `apps/web → next@15.5.18 → postcss` — GHSA-qx2v-qp2m-jg93 / CVE-2026-41305 (XSS via `</style>` in stringify under specific embedding conditions).

---

## Phase 7 — LLM / OpenRouter alignment

- **Tool SSRF:** OpenRouter-exposed tools call **PER only** (`packages/agent/src/tools.ts`) — fixed base URL from env, not user-supplied URLs. **`pay_resource` is not** registered in `toolDefinitions` (`packages/agent/src/agent.ts`, `packages/agent/src/index.ts` exports); SSRF risk is **design/TODO** if later wired.
- **Prompt injection:** `chat()` passes PER tools to the model (`packages/agent/src/agent.ts`). Code comments acknowledge sandboxing for untrusted input — **no** in-repo policy engine or human approval before `per_deposit`.

**OWASP LLM Top 10 (2025) mapping (subset):**

| Finding theme | Label |
|---------------|-------|
| Unbounded tool execution from model | **LLM01** Prompt Injection |
| Dependency CVE | **LLM06** (Sensitive Information Disclosure) indirect via vulnerable components — map also to **A06:2021** Vulnerable Components |

---

## Phase 9 (subset) — Operational hardening

- No rate limiting or auth middleware in `apps/web` (no `middleware.ts` found).
- `per-proxy/health` returns raw PER response body to clients — acceptable only if PER guarantees non-sensitive `/health`.

---

## Phase 10 — STRIDE (abbreviated)

| ID | Category | Component | Note |
|----|----------|-----------|------|
| S1 | Spoofing | Web | No user authentication in repo |
| T1 | Tampering | Agent tools | `per_deposit` forwards JSON to PER — integrity depends on PER |
| I1 | Information disclosure | `per-proxy/health` | Proxied JSON visible to route callers |
| D1 | Denial of service | Public API routes | No throttling in-repo |
| E1 | Elevation | Agent | No RBAC on tool invocation |

---

## Phase 11 — Data classification (light)

| Class | Examples in scope |
|-------|-------------------|
| Secret | `OPENROUTER_API_KEY`, `MPP_SECRET_KEY` |
| Internal config | `PER_PRIVATE_PAYMENT_BASE_URL`, Tempo addresses |
| Operational | PER health JSON, `local-health` timestamp |

---

## Phase 12 — False positive / noise filter

**Filtered or downgraded (confidence &lt; 8/10 or speculative):**

- Exploitability of PostCSS XSS in **this** app without untrusted CSS embedding pipeline (still patch deps).
- SSRF via `pay_resource` until it becomes an LLM tool with arbitrary URLs.
- Internal-metadata SSRF via `PER_*` URL — requires operator misconfiguration.

**Count (speculative/low-confidence items logged):** **3**

---

## Phase 13 — Findings table (daily gate ≥ 8/10 confidence)

| ID | Severity | Confidence | Finding | Evidence |
|----|----------|------------|---------|----------|
| DEP-1 | Moderate (supply chain) | 9/10 | Transitive PostCSS &lt; 8.5.10 (CVE-2026-41305 / GHSA-qx2v-qp2m-jg93) | `pnpm audit`; path `next → postcss` |
| AGENT-1 | High (design / conditional impact) | 8/10 | OpenRouter `chat()` exposes financial PER tools without in-repo authorization or HITL | `packages/agent/src/agent.ts`, `packages/agent/src/tools.ts` |

**Severity counts (reportable):** Critical 0, High 1, Moderate 1, Low 0.

---

## Agentic Actions Auditor (local)

- **Workflow files glob:** `.github/workflows/*.yml`, `.yaml` — **0 files** (`.github` missing).
- **AI actions** (`anthropics/claude-code-action`, `run-gemini-cli`, `openai/codex-action`, `actions/ai-inference`): **none** — nothing to analyze.

---

## Remediation roadmap

| Priority | Action | Owner |
|----------|--------|-------|
| P0 | Upgrade Next / overrides so `postcss >= 8.5.10` when ecosystem compatible | Eng |
| P1 | Before production agent UX: policy gate or HITL for `per_deposit`; separate read-only tools from write paths | Eng |
| P2 | If routes are internet-facing: add auth or network restriction; consider redacting `per-proxy/health` payload | EngOps |
| P3 | If `pay_resource` becomes model-callable: implement host allowlist (`ALLOWLIST_NOTE` in `tools.ts`) | Eng |

---

## Confidence calibration

- **Daily 8/10 gate:** Two findings listed in Phase 13; three items deliberately held back as speculative or environment-dependent.
- **Residual uncertainty:** PER server-side validation strength and production deployment exposure are **not** derivable from this repo alone — see `security/PrivateMPP-threat-model.md` questions.

---

## Related artifacts

- Threat model: `security/PrivateMPP-threat-model.md`
- History: ``security/reports/history.md``
