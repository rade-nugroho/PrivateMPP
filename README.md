# PrivateMPP

Production-minded **devnet-first** scaffold for **private agent payments**: **MagicBlock Private Payments API (PER)** over HTTPS plus **HTTP 402** flows using **`mppx`** (Payment HTTP Authentication Scheme). See **`docs/PRD.md`** for goals, non-goals, and roadmap.

## Quickstart

```bash
pnpm install
cp .env.example .env
# Edit .env — use a real PER devnet base URL from your deployment/docs (never commit secrets).

pnpm -r run build
pnpm web:dev
# Open http://localhost:3000 — links to /api/local-health, /api/per-proxy/health, /api/example-paid

pnpm agent:dev
# Requires PER_PRIVATE_PAYMENT_BASE_URL for health; OPENROUTER_API_KEY optional.
```

## Workspace layout

| Path | Description |
|------|-------------|
| `apps/web` | Next.js App Router — health, PER proxy, **`mppx/server`** example-paid route |
| `packages/per-client` | Typed PER REST client + Zod + path constants + MPP custom stubs |
| `packages/mpp-bridge` | `mppx/server` helpers (`createTempoDemoMppx`, paid handler sketch), PER settle stub |
| `packages/agent` | OpenRouter + PER tools + `pay_resource` (see `packages/agent/src`) |
| `docs/` | PRD + architecture (high/low level) |

## Architecture

- **High level**: `docs/architecture-high-level.md` — context, containers, 402 flow.
- **Low level**: `docs/architecture-low-level.md` — modules, env vars, PER method map, security checklist.

## Key references

- MagicBlock PER API overview: [Introduction](https://docs.magicblock.gg/pages/private-ephemeral-rollups-pers/api-reference/per/introduction), OpenAPI hub [payments.magicblock.app/reference](https://payments.magicblock.app/reference)
- **`mppx`**: [mpp.dev/sdk/typescript](https://mpp.dev/sdk/typescript), custom payment methods [mpp.dev/payment-methods/custom](https://mpp.dev/payment-methods/custom)
- OpenRouter TypeScript SDK (beta): [Agent SDK overview](https://openrouter.ai/docs/agent-sdk/typescript/overview)

## Devnet launch checklist

1. Obtain **PER HTTPS base URL** for devnet from your MagicBlock / deployment docs—set `PER_PRIVATE_PAYMENT_BASE_URL`.
2. Confirm **GET /health** via `GET /api/per-proxy/health` or `pnpm agent:dev` (PER health in CLI).
3. Configure **`mppx`** secrets **only** for the Tempo example route: `MPP_SECRET_KEY`, `MPP_TEMPO_CURRENCY`, `MPP_TEMPO_RECIPIENT` (see `.env.example`). Without them, `/api/example-paid` returns **503** by design.
4. Enable OpenRouter only if needed: `OPENROUTER_API_KEY` for agent LLM calls—keep keys out of git and logs.

## Verification

Last verified: `pnpm -r run build` (TypeScript + `next build`). Run locally after clone.

## Troubleshooting

- **`packages/mpp-bridge`**: An older experimental package may reappear in some checkouts; it is **not** part of this scaffold. Remove the folder if present (`rm -rf packages/mpp-bridge`) so `pnpm -r run build` stays green—the supported pattern is **`mppx`** in `apps/web` plus `mpp-custom-stub` in `@private-mpp/per-client`.

If `next build` fails on missing `.next/types/...` entries, run `rm -rf apps/web/.next` and build again.

## License

Private / unspecified — add a SPDX license when product policy allows.
