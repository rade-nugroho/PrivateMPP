# `apps/web` — Next.js surface

## Routes (development)

| Route | Behavior |
|-------|----------|
| `GET /api/local-health` | Process liveness JSON |
| `GET /api/per-proxy/health` | Proxies PER `GET /health` when `PER_PRIVATE_PAYMENT_BASE_URL` (or `PER_API_BASE`) is set — otherwise **503** |
| `GET /api/example-paid` | **`mppx/server`** demo: **402** + challenge without payment; **200** + receipt-wrapped JSON when configured and paid |

The paid route is **not** production-ready—it illustrates **challenge → credential → receipt**. For bridging **PER** settlement proofs into MPP, see [custom payment methods](https://mpp.dev/payment-methods/custom) and `packages/per-client` exports from `mpp-custom-stub.ts`.

## Env

See root `.env.example`. Next.js loads `.env` / `.env.local` per [Next.js env rules](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables).
