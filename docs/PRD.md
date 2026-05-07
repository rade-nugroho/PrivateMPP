# PrivateMPP — Product Requirements (PRD)

## Problem

Software agents increasingly purchase digital goods and services on behalf of users. Plain HTTP payments expose payer identity, correlation across merchants, and settlement metadata that does not meet emerging expectations for **wallet-level privacy** and **least-privilege disclosure**. Teams also need a **devnet-first** path to integrate payment-gated APIs without shipping signing keys in CI.

## Goals

1. **Private agent payments**: route settlement through protocol-aligned private payment flows (MagicBlock **Private Ephemeral Rollup** / **Private Payments API** surfaces), preserving a conservative privacy narrative—**no legal claims**; describe outcomes as protocol- and deployment-dependent.
2. **HTTP 402 + MPP**: expose payment challenges using the Payment HTTP Authentication Scheme via **`mppx`** (challenge → credential → receipt), including hooks for **custom payment methods** when bridging PER proofs into MPP credentials ([custom methods](https://mpp.dev/payment-methods/custom)).
3. **Agent-safe ergonomics**: thin OpenRouter-capable agent tooling with **strict validation** on tool arguments and **no secret logging**.
4. **Marketplace vision (stubs only)**: define interfaces for future connectors (e.g. retail, travel) **without** implying live integrations or scraping—real connectors require partner APIs and compliance review.

## Non-goals

- Production merchant integrations (Amazon, Airbnb, etc.) without documented APIs and contractual/compliance review.
- Legal interpretation of privacy, sanctions, or licensing—product copy stays **descriptive** and **protocol-aligned**.
- Shipping Solana program source in this repository (optional later); this scaffold focuses on **PER REST**, **mppx**, and **Next.js** route handlers.

## User stories

1. **As a developer**, I want a typed PER HTTP client so I can call health, challenge/login, SPL operations, swap, and MCP consistently across environments.
2. **As a platform engineer**, I want a Next.js route that returns **402** with a payment challenge so clients can complete **`mppx`** flows before accessing a resource.
3. **As an agent operator**, I want tools that call PER **only** with schema-validated inputs and allowlisted URLs for any outbound fetch.
4. **As a security reviewer**, I want documentation of trust boundaries, OWASP LLM agent considerations, and explicit “no raw user URL fetch” rules.

## Success metrics

| Metric | Target (initial) |
|--------|------------------|
| Devnet integration demo | End-to-endunsigned tx build + signing path documented |
| 402 example route | Returns challenge when unpaid; receipt-wrapped JSON when paid (configured env) |
| Build health | `pnpm -r run build` passes in CI |
| Secret hygiene | No keys in repo; `.env` gitignored |

## Phased roadmap

| Phase | Scope |
|-------|--------|
| **P0 — Devnet scaffold** | PER client, Next.js health + paid example, agent stub, docs |
| **P1 — Hardening** | Allowlists for agent fetches, HITL for high-value PER actions, structured logging without PII |
| **P2 — Custom MPP ↔ PER** | Implement `mppx` custom method using verified PER settlement proofs (see `mpp-custom-stub`) |
| **P3 — Production** | Mainnet PER base URLs, secrets management, observability, rate limits, marketplace connector adapters behind feature flags |

## Risks

- **Model & tool abuse (OWASP LLM)**: untrusted tool arguments, prompt injection into payment params, exfiltration via URLs—mitigate with validation, allowlists, and human approval for irreversible transfers.
- **Dependency supply chain**: `mppx`, `@modelcontextprotocol/sdk`, and wallet libraries—pin versions and audit updates.
- **Protocol drift**: PER OpenAPI and paths may evolve—centralize path constants and watch [MagicBlock docs](https://docs.magicblock.gg/pages/private-ephemeral-rollups-pers/api-reference/per/introduction) and [public reference](https://payments.magicblock.app/reference).
- **Privacy expectations**: “Private” is **not** a guarantee of legal anonymity—communicate limits clearly.
