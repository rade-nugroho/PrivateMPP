# Private MPP on MagicBlock PER with MPP & OpenRouter Agents

## Executive overview

This document specifies a Private Machine Payments Protocol (Private MPP) stack that lets AI agents privately pay merchants using MagicBlock’s Private Ephemeral Rollups (PER) and Private Payments API, integrated with MPP/x402-style HTTP 402 flows and OpenRouter-based agents.[^1][^2][^3] The target is a production-ready SDK and agent skill that supports agent-to-agent payments, marketplace integrations (Amazon, Airbnb, Shopify, Nomadz), compliant privacy, and fast gasless UX on Solana.

## Problem and goals

### Pain points

- Agents and users need to pay for APIs, goods, and services with crypto, but existing flows are public, fragmented, and require manual key management or account setup.[^3][^4]
- Privacy-preserving crypto rails exist but rarely meet compliance (OFAC, AML, geofencing) and are not packaged for agent flows or HTTP 402 semantics.[^5][^6]
- Merchant integrations (Amazon, Shopify, Airbnb, Nomadz) typically expect fiat rails or card/Stripe primitives; bridging from private SPL payments into these flows requires an MPP-compatible abstraction.[^3][^7]

### Goals for Private MPP

- Allow AI agents to privately transact with merchants over Solana via PER with compliant privacy (TEE, IP geofencing, OFAC checks).[^5][^8]
- Provide a Private MPP SDK and agent skill that abstracts MagicBlock PER endpoints, MPP/x402 client logic, and OpenRouter tool definitions.
- Support connections to marketplaces (Amazon, Airbnb, Shopify, Nomadz) by exposing a generic MPP endpoint that can back merchant-specific adapters.[^3][^9]
- UX properties: fast, gasless private payments on PER, with x402-style HTTP 402 flows and MPP-compliant challenges/credentials/receipts.
- Ship a Devnet launch and path to production mainnet deployment, plus documentation (PRD, high-level and low-level architecture, API docs, examples).

## MagicBlock PER & Private Payments API

### PER capabilities

MagicBlock’s Ephemeral Rollups (ER) and Private Ephemeral Rollups (PER) move state execution into specialized SVM runtimes with gasless transactions, faster block times, and horizontal scaling, while keeping base-layer read compatibility.[^5] PER layers TEE-based private execution and a compliance framework (IP geofencing, OFAC-sanctioned jurisdiction filtering) on top of ER.[^8]

### Private Payments API surface

MagicBlock exposes a Private Payments API at `https://payments.magicblock.app` that builds unsigned SPL token transactions (deposit, transfer, withdraw, initialize-mint, swaps) and exposes balance queries together with an auth flow for private balances.[^1][^2] Key endpoints:

- `GET /health` – simple health check returning `{ "status": "ok" }`.[^10]
- `GET /v1/spl/challenge` – issues a wallet-specific challenge string used for auth.[^2]
- `POST /v1/spl/login` – verifies a signature over the challenge and returns a bearer token for private data and PER-connected transfers.[^2]
- `GET /v1/spl/balance` – base-chain SPL token balance for an address and mint.[^11]
- `GET /v1/spl/private-balance` – PER (ephemeral) SPL token balance; requires `Authorization: Bearer <token>`.[^12]
- `POST /v1/spl/deposit` – builds an unsigned deposit transaction from Solana base to PER, wrapping the `delegateSpl` flow and handling ATA/vault initialization and idempotency.[^1][^2]
- `POST /v1/spl/withdraw` – builds an unsigned withdrawal transaction from PER back to base.[^7]
- `POST /v1/spl/transfer` – builds unsigned SPL transfers, public or private, across base and PER balances, with delay and split parameters for private flows.[^5]
- `POST /v1/spl/initialize-mint` – initializes PER transfer queue state for a mint, returning `transferQueue` and `rentPda` along with the transaction.[^4]
- `GET /v1/spl/is-mint-initialized` – checks whether a mint has an initialized transfer queue for a given validator.[^3]
- `POST /v1/swap/quote` & `POST /v1/swap/swap` – quote and build swap transactions between SPL mints (from docs index).[^2]
- `POST /mcp` – MCP JSON-RPC endpoint that exposes PER functionality as a Model Context Protocol tool, returning both natural language content and structured transaction payloads.[^13]

These endpoints return `transactionBase64`, `sendTo` (`"base"` or `"ephemeral"`), `recentBlockhash`, `lastValidBlockHeight`, `instructionCount`, `requiredSigners`, and `validator`, which are sufficient for client-side signing and submission to the indicated RPC.[^1][^1]

## MPP and x402 fundamentals

### MPP (Machine Payments Protocol)

MPP standardizes HTTP 402 Payment Required for machine-to-machine payments via a Challenge → Credential → Receipt flow, agnostic to underlying payment methods.[^5] Servers respond with `402` plus a `WWW-Authenticate: Payment ...` header containing a payment method (Tempo, Stripe, Lightning, Solana, custom), intent (`charge` or `session`), price, and other parameters; clients construct a Credential proving payment, retry the request with `Authorization`, and receive a Receipt in a `Payment-Receipt` header on success.[^5][^7]

The `mppx` TypeScript SDK provides client/server primitives (`Mppx.create`, `Method.from`, `Method.toClient`, `Method.toServer`) and supports built-in payment methods, as well as custom methods defined by developers.[^5][^8] Custom methods implement schemas for request parameters and credential payloads, plus client `createCredential` and server `verify` logic.[^8]

### x402

x402 is an earlier HTTP 402 protocol by Coinbase that focuses on gasless stablecoin payments, often via EIP-3009 signature-based transfers from a TEE-managed wallet.[^2] Servers respond with HTTP 402 and payment requirements; an x402 client library signs a gasless USDC transfer and retries the request, with settlement handled by a facilitator.[^2] MPP is explicitly designed to subsume x402: existing x402 exact flows map to MPP’s `charge` intent, and there is a documented upgrade path.[^5][^7]

## High-level architecture

### System components

- **Private MPP Server** – Node/TypeScript service that:
  - Exposes HTTP endpoints protected by MPP `402` flows using `mppx` (Tempo/Stripe/etc.).
  - Integrates with MagicBlock’s Private Payments API to settle payments as private SPL transfers on PER (USDC on Solana).
  - Optionally exposes x402-compatible endpoints for compute-style use cases.

- **Private PER Payment Method (`mppx-per`)** – Custom MPP payment method that treats PER USDC as the settlement rail, implemented as a dynamic extension or first-party SDK in the MPP sense.[^8]

- **Agent Wallet / Key Management** – Off-chain agent wallet that holds Solana keys and MPP-compatible payment credentials; can be a Tempo wallet for MPP and a Solana keypair for PER deposits/withdrawals.[^5][^11]

- **OpenRouter Agent Skill** – A modular agent built with `@openrouter/agent` (new agent SDK) or `@openrouter/sdk` per the SKILL.md that includes tools for:
  - Discovering MPP-enabled endpoints and costs.
  - Initiating payments using the `mppx-per` method.
  - Calling MagicBlock MCP endpoint `/mcp` to build PER transactions.

- **Merchant adapters** – Small services or Lambda-style functions that map MPP receipts (representing paid PER transfers) to external marketplace actions (e.g., paying an Amazon gift card provider, or interacting with Shopify/Stripe APIs).

### Data and control flow

1. **Discovery** – Agent discovers a merchant API or marketplace adapter that advertises MPP payment requirements (Tempo, Stripe, plus custom `per` method) via OpenAPI discovery or docs.[^5][^7]
2. **Quote** – Agent requests a price quote for a good/service; server returns a price denominated in USD or USDC, along with details for PER settlement.
3. **HTTP 402 Challenge** – Agent calls the paid resource; server returns `402` with a MPP Challenge referencing `method="per" intent="charge" amount="..." currency="USDC" ...` plus metadata needed for PER.
4. **Credential construction** – Agent uses `mppx-per` client method:
   - Ensures PER mint is initialized (`/v1/spl/is-mint-initialized`, `/v1/spl/initialize-mint` if missing).[^3][^4]
   - Calls `/v1/spl/deposit` if needed to fund PER from base-chain USDC.[^1]
   - Calls `/v1/spl/transfer` with `visibility="private"` and `fromBalance="ephemeral"`, `toBalance="ephemeral"` or `base` depending on design.[^5]
   - Produces a Credential that encodes proof of payment (e.g., transfer queue reference, amount, recipient, and optional transaction signature once sent).
5. **Retry with Credential** – Agent retries the original request with `Authorization: Payment ...` carrying the Credential; server verifies it via `mppx-per` server method.
6. **Receipt & fulfillment** – Server returns the paid resource and a MPP Receipt confirming the PER payment, and triggers merchant-side fulfillment.

## Private MPP SDK design (TypeScript)

### Package boundaries

Proposed monorepo structure:

- `packages/private-mpp-core` – Shared domain types, config, and helper functions for PER + MPP integration.
- `packages/private-mpp-mppx` – MPP custom payment method implementation (`per`), server and client modules built on `mppx`.[^8]
- `packages/private-mpp-magicblock` – Thin wrapper around MagicBlock Private Payments API (fetch-based client, zod-validated responses) using the OpenAPI specs listed in `llms.txt`.[^2]
- `packages/private-mpp-agent-skill` – OpenRouter agent integration exposing tools and Agent wrappers for Private MPP.
- `apps/private-mpp-example-api` – Example server implementing MPP-protected resources and x402 endpoints.
- `apps/private-mpp-example-frontend` – Next.js landing page and documentation site.

### Core TypeScript interfaces

Key domain types for the SDK:

```ts
// Private MPP-specific config
interface PerConfig {
  baseCluster: 'mainnet' | 'devnet';
  perValidator: string; // e.g. MAS1Dt9qreoRMQ14YQuhg8UTZMMzDdKhmkZMECCzk57
  usdcMint: string; // different for mainnet/devnet
  apiBaseUrl: string; // https://payments.magicblock.app
}

interface PerAccountContext {
  owner: string; // Solana pubkey
  ata?: string; // cached ATA
}

interface PerPaymentRequest {
  amount: string; // decimal USDC as string, e.g. '1.50'
  currency: 'USDC';
  merchantPerAddress: string; // PER destination address or vault
  visibility: 'private';
}

interface PerPaymentProof {
  transferQueue: string;
  validator: string;
  mint: string;
  amount: string; // atomic units
  from: string;
  to: string;
  signature?: string; // base58 once broadcast
}
```

### MagicBlock client module

Using the `llms.txt` index and PER OpenAPI JSON, generate a typed client for:

- `health()` → `GET /health`.
- `challenge(pubkey)` → `GET /v1/spl/challenge?pubkey=...`.
- `login({ pubkey, challenge, signature })` → `POST /v1/spl/login` (returns bearer `token`).[^2]
- `balance({ address, mint, cluster })` → `GET /v1/spl/balance`.[^11]
- `privateBalance({ address, mint, cluster, token })` → `GET /v1/spl/private-balance` with `Authorization: Bearer`.[^12]
- `isMintInitialized({ mint, cluster, validator? })` → `GET /v1/spl/is-mint-initialized`.[^3]
- `initializeMint({ payer, mint, validator, cluster })` → `POST /v1/spl/initialize-mint` returning unsigned tx.[^4]
- `deposit({ owner, amount, mint?, validator?, cluster, initIfMissing?, initVaultIfMissing?, initAtasIfMissing? })` → `POST /v1/spl/deposit` returning unsigned tx + routing metadata.[^1]
- `withdraw({ owner, amount, mint, validator?, cluster, idempotent? })` → `POST /v1/spl/withdraw`.[^7]
- `transfer({ from, to, mint, amount, visibility, fromBalance, toBalance, ... })` → `POST /v1/spl/transfer`.[^5]
- `mcp(request)` → `POST /mcp` MCP JSON-RPC, if needed for agent tooling.[^13]

The client should:

- Decode `transactionBase64` using `@solana/web3.js`, allow injection of a signer (keypair, wallet adapter, or session key) and `connection.sendRawTransaction` to either base or PER RPC (`sendTo`).[^1]
- Provide high-level helpers like `ensurePerMintInitialized`, `ensurePerFunded`, `perPrivateTransfer` that orchestrate multiple REST calls.

## MPP custom payment method: `per` (Private PER)

### Method definition

Use `Method.from` from `mppx` to define `per` as a `charge`-intent payment method.[^8]

- **Request schema** (server-side Challenge fields):
  - `amount` – decimal string (USD or USDC), normalized via `z.pipe` into atomic units with `parseUnits`.[^8]
  - `currency` – `"USDC"`.
  - `perConfig` – validator and mint identifiers (`validator`, `mint`, `cluster`).
  - `merchant` – PER recipient info (`recipientPerAddress` or `transferQueue` id).

- **Credential payload schema**:
  - `paymentProof` – fields from `PerPaymentProof` (`validator`, `mint`, `amount`, `from`, `to`, `transferQueue`, optional `signature`).

### Client implementation

`Method.toClient(per, { createCredential })` should:

1. Parse the MPP Challenge to extract amount, currency, and PER config.
2. Use the MagicBlock client to:
   - Optionally call `challenge`/`login` to obtain a bearer token when the transfer requires connecting to PER (for private-balance reads or private routing).
   - Check `isMintInitialized`; if false, build and sign `initialize-mint` tx, send to base RPC, wait for confirmation.[^3][^4]
   - Ensure PER funding by calling `deposit` if needed, signing and sending the returned `transactionBase64` to base RPC, then verifying with `private-balance`.[^1][^12]
   - Build a `transfer` with `visibility="private"`, `fromBalance="ephemeral"`, and `toBalance` per the server’s spec (e.g., merchant’s PER account).[^5]
   - Sign and send the transfer to the appropriate RPC.
3. Package a Credential via `Credential.serialize({ challenge, payload: { paymentProof } })` using the on-chain parameters and signature as `reference`.

### Server implementation

`Method.toServer(per, { request, verify })` should:

- In `request` hook:
  - Normalize the `amount` into PER atomic units and annotate `perConfig` with the service’s configured validator/mint/cluster; optionally compute a `merchantPerAddress` or `transferQueue`.
- In `verify` hook:
  - Reconstruct the expected PER payment from the Challenge (amount, currency, merchant, mint, validator).
  - Verify that the Credential’s `paymentProof` matches on all critical fields, and optionally query MagicBlock base or PER RPC (via `getTransaction` or reading PER state) to confirm the transfer.[^2][^11]
  - On success, return a Receipt via `Receipt.from({ method: 'per', reference, status: 'success', timestamp: ... })`.

This design mirrors the custom payment method example for Lightning in the MPP docs, but with PER’s private SPL transfer semantics replacing BOLT11 invoices and preimages.[^8]

## x402 integration with Private Payment API

### x402 recap

In Magic’s x402 guide, an Express server uses `@x402/express` middleware to protect routes with payment requirements, and an x402 client or fetch wrapper (`@x402/fetch`) automatically handles 402 responses by signing a gasless USDC transfer via a TEE and retrying the request.[^2] Payments are gasless for the payer and rely on EIP-3009 in a TEE-managed wallet.[^2]

### Mapping PER/x402

There are two ways to integrate x402-style flows with PER:

- **Direct x402 bridge** – Use a separate EVM wallet in a TEE to pay x402 charges, and periodically swap/bridge to Solana USDC, then deposit into PER; this is more complex but leverages existing x402 infra.
- **MPP upgrade path** – Follow MPP’s `upgrade-x402` guidance by implementing the same semantics via MPP `charge` using the `per` payment method while optionally still supporting x402 endpoints for legacy clients.[^5][^7]

For Private MPP, favor the second approach: implement MPP `per` method as the canonical path and provide an x402-compatible wrapper that internally calls the same settlement logic.

## Agent-to-agent integration (OpenRouter)

### OpenRouter agent core

The OpenRouter SKILL defines a modular agent built around a standalone `Agent` class, using `@openrouter/sdk` (or the newer `@openrouter/agent`) to call models with tools and streaming.[^1][^9] The agent:

- Accepts messages and maintains conversation state.
- Supports tools via `tool()` and an items-based streaming model.
- Exposes events like `tool:call`, `tool:result`, and `reasoning:update` for observability.[^9]

### Private MPP tools for agents

Define tools in `private-mpp-agent-skill` for:

1. **per_get_quote** – Input: merchant id, item sku, quantity. Output: price quote, currency, and MPP endpoint URL.
2. **per_pay_invoice** – Input: quote id or price, merchant id, and optional payment options; uses `mppx-per` to pay and returns a Receipt (including PER payment proof and any external merchant confirmation).
3. **per_get_private_balance** – Input: address, mint; reads `private-balance` via MagicBlock client using the auth flow.[^12]
4. **per_deposit/withdraw** – Administrative tools for agents to manage PER funding.

These tools call the Private MPP SDK under the hood, so the agent can reason about when to pay, how much, and through which method, but does not have to know about PER internals.

### Agent-to-agent payments

To support agent-to-agent payments (e.g., one agent delegating compute or buying services from another agent), use:

- MPP’s MCP transport binding, which maps Challenges, Credentials, and Receipts onto MCP JSON-RPC frames.[^5]
- MagicBlock’s MCP endpoint `/mcp`, which already returns structured content suitable for MCP tooling.[^13]

One agent can operate an MCP server that exposes paid tools; the other agent uses `McpClient.wrap` in `mppx` to handle payments when invoking these tools, settling on PER via `per` payment method.[^5][^8]

## Frontend: landing page and docs (Next.js)

### Requirements

- Marketing site explaining Private MPP, with sections for:
  - What is PER and why private payments.
  - How MPP/x402 works and why `per` is a first-class payment method.
  - Agent integrations: OpenRouter, MCP, and marketplaces.
- Developer docs:
  - Quickstart: install packages, configure PER, perform first private payment using Devnet USDC.[^6]
  - SDK reference for `private-mpp-magicblock`, `private-mpp-mppx`, `private-mpp-agent-skill`.
  - Examples: pay for a mock Amazon purchase; settle an Airbnb-like booking; pay a Nomadz-like travel service.

### Tech stack

Use Next.js (App Router), with MDX or a docs framework (e.g., Nextra or Contentlayer) to author documentation. UI guidelines:

- Clear split between **Concepts** (PER, MPP, x402, agents) and **API Reference** (TypeScript signatures, endpoint examples).
- Code samples in TypeScript with copy buttons.
- UX design emphasizes trust (compliant privacy, audits) and simplicity ("one SDK for private machine payments on Solana"). MagicBlock’s own docs emphasize high-performance, compliant privacy; mirror this tone.[^5][^6]

## Production and Devnet stages

### Devnet launch

- Use `cluster="devnet"` for MagicBlock endpoints; defaults map to Devnet USDC mint.[^1][^11]
- Choose the Devnet PER validator, e.g., `MAS1Dt9qreoRMQ14YQuhg8UTZMMzDdKhmkZMECCzk57` for Asia or other region-specific validators per quickstart docs.[^6]
- Provide test frontends and Postman collections for:
  - Health checks.
  - Mint initialization.
  - Deposits to PER from Devnet USDC.
  - Private transfers between test accounts.
  - MPP-protected example API (`/premium-resource`) with `per` payment method.

### Production rollout

- Switch to `cluster="mainnet"` and mainnet PER validators for target regions.[^6]
- Implement geofencing and compliance checks aligned with MagicBlock’s framework (MagicBlock already geofences OFAC-sanctioned jurisdictions at PER ingress).[^8][^12]
- Harden the MPP server with TLS, secret management for `MPP_SECRET_KEY`, and robust logging/monitoring following MPP security guidelines.[^5]

## PRD (Product Requirements Document)

### Target users

- AI infra builders (agentic OS, MCP tool providers).
- Solana DeFi and payment dApps that need privacy and agent-native payment flows.
- Marketplaces and merchants who want to accept private USDC on Solana via MPP without complex blockchain integration.

### Core user stories

- As an agent developer, I want my agent to pay for APIs and services using private USDC on Solana without exposing transaction graphs, so that I can preserve user privacy while remaining compliant.
- As a merchant, I want to accept private payments that settle on Solana with minimal integration effort, so I can reach crypto-native agents/customers.
- As a marketplace integrator, I want to plug into Amazon/Shopify-like experiences using a single payment abstraction, so I don’t rebuild payment logic for each vendor.

### Functional requirements

- Private MPP SDK must:
  - Wrap MagicBlock PER endpoints with typed, documented functions.
  - Implement a `per` MPP payment method for `charge` intent.
  - Provide helpers for funding PER (deposit), private transfers, and withdrawals.
  - Offer OpenRouter agent tools and examples.
- System must support Devnet and Mainnet clusters.
- Payments must be private by default (`visibility="private"` plus optional delay/split configurations), with configurable public transfers when necessary.[^5]

### Non-functional requirements

- Latency: end-to-end payment + resource retrieval should complete in under a few seconds under normal load, with PER’s faster block times helping to keep UX acceptable.[^5]
- Security: follow MPP security guidance (HMAC-bound challenges, TLS) and MagicBlock’s compliance framework; never leak `MPP_SECRET_KEY` or wallet secrets.[^5][^8]
- Observability: structured logging of Challenges, payment attempts (without sensitive secrets), and receipts for debugging and audits.

## Low-level architecture

### Sequence: private payment for an API call

1. Agent calls `GET /premium` on Private MPP API without Credential.
2. Server responds `402` with MPP Challenge using `per` method.
3. Agent’s `per` client method:
   - Calls MagicBlock `health` to confirm availability.[^10]
   - Ensures PER mint initialized via `is-mint-initialized` / `initialize-mint` if needed.[^3][^4]
   - Checks PER balance via `private-balance` (requires auth) and calls `deposit` if insufficient.[^12][^1]
   - Builds and submits a private `transfer` from agent PER account to merchant PER account.[^5]
   - Constructs Credential with `paymentProof` from transfer parameters and signature.
4. Agent retries request with Credential.
5. MPP server `verify` uses MagicBlock RPC (`getTransaction` or `private-balance`) to confirm payment,[^2][^11] and returns 200 with the resource and a Receipt.

### Solana key management

- For development, use a local keypair (e.g., generated and stored in a secure file) and `@solana/web3.js` to sign deposit/withdraw/transfer transactions.
- For production, consider:
  - Session keys using MagicBlock session-keys tooling to avoid exposing long-lived keys in client apps.[^11]
  - HSMs or custodial wallets if running server-side payment agents.

### Error handling

- If PER endpoints fail health check (`status != ok`), the MPP method should fail fast and surface an explicit error.
- If mint initialization or funding fails, return an MPP error that the agent can interpret and potentially retry or choose an alternate payment method.
- When verification fails, `verify` must throw and the server should respond with a 402 or 4xx following MPP’s guidance on problem details.[^5]

## Documentation and examples

### Example flows

- **Counter example** – Mirror MagicBlock’s private counter example by charging MPP `per` payments for each increment in a "paid counter" app; use PER-backed transfers to pay for increments and show balances in private and public views.[^6]
- **Marketplace checkout** – A demo where an agent buys a virtual good from a Nomadz-like travel marketplace using `per` payments; illustrate automatic PER funding and private transfer.
- **Agent-to-agent compute** – Two OpenRouter agents where one sells LLM compute, exposing an MCP server with MPP `per` payments, and the other buys tokens via Private MPP.

### Docs structure

- **Concepts** – PER, Private Payments API, MPP, x402, agentic payments.
- **How-to guides** –
  - Set up PER Devnet funding.
  - Implement a `per` MPP server in Hono/Express.
  - Add Private MPP payments to an MCP server.
  - Integrate an OpenRouter agent with Private MPP tools.
- **Reference** – SDK API docs generated from TypeScript, plus linked PER and MPP docs using their official indexes.[^2][^5]

***

This architecture aligns MagicBlock PER’s compliant private SPL transfers with MPP’s HTTP 402 standard and OpenRouter’s agent framework, enabling private, gasless-like payments for agents that can plug into existing web marketplaces and agent ecosystems.[^1][^2][^5]

---

## References

1. [Introduction - MagicBlock Documentation](https://docs.magicblock.gg/pages/private-ephemeral-rollups-pers/api-reference/per/introduction) - Private Payments API documentation

2. [x402 Payments - Developer Docs | Magic](https://docs.magic.link/recipes/server-wallets/x402-payments) - This guide shows how to use Magic's Express Server Wallet to pay for x402-protected API endpoints. x...

3. [MPP - Machine Payments Protocol](https://mpp.dev/overview)

4. [MPP payments | Stripe Documentation](https://docs.stripe.com/payments/machine/mpp?locale=en-GB)

5. [Ephemeral Rollup - MagicBlock Documentation](https://docs.magicblock.gg/pages/get-started/introduction/ephemeral-rollup) - The ephemeral rollup functions as a specialized SVM runtime, significantly enhancing transaction thr...

6. [Blog - MagicBlock](https://www.magicblock.xyz/blog) - Introducing MagicBlock Private Payments API. MagicBlock private payment API unlock confidential SPL ...

7. [Quickstart | MPP - Machine Payments Protocol](https://mpp.dev/quickstart)

8. [magicblock-labs/magicblock-engine-examples: Ephemeral Rollups](https://github.com/magicblock-labs/magicblock-engine-examples) - This repository contains examples of how delegate/undelegate accounts and run transactions in an Eph...

9. [Payment methods](https://developers.cloudflare.com/agents/agentic-payments/mpp/) - Accept and make payments using the Machine Payments Protocol (MPP) on Cloudflare Workers.

10. [x402 on Solana](https://x.com/SebastianWols17/status/2051559524553699643) - Vision language models paying for compute in real time. @magicblock shipped private payments via x40...

11. [Usage Example - MagicBlock Documentation](https://docs.magicblock.gg/pages/tools/session-keys/usage-examples) - This method first signs the transaction using the ephemeral key pair created during the session. The...

12. [Magicblock Launched Private Payments API On Solana For ... - Reddit](https://www.reddit.com/r/solana/comments/1sc0r2t/magicblock_launched_private_payments_api_on/) - The MagicBlock Private Payments API is now live on @Solana. Add confidential SPL transfers into your...

13. [From Broke Bots to Streaming Economies: Building the Agent ...](https://dev.to/xavier_script/from-broke-bots-to-streaming-economies-building-the-agent-economy-wallet-edb) - Comprehensive Documentation: I built a full Mintlify documentation hub outlining the architecture, t...

