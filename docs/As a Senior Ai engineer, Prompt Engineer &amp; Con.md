<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# As a Senior Ai engineer, Prompt Engineer \& Context Engineer, create Prompt Instruction for Agent Coder Cursor to develop this Project. (fyi im using multitask feature in cursor)

Berikut adalah set _prompt instruction_ yang bisa langsung kamu pakai di Cursor Agent (dan dipecah ke beberapa agent lewat multitask/worktree). Fokusnya: plan-first, scope jelas per agent, dan konsisten dengan arsitektur Private MPP di MagicBlock PER.

***

## 1. Strategy singkat (cara pakai di Cursor)

- Pakai **multi-agent / multitask** dengan _scope_ terpisah per area:

1) core SDK MagicBlock PER, 2) MPP method `per`, 3) OpenRouter Agent skill, 4) Next.js landing + docs.[^1][^2]
- Untuk tiap agent, minta **PLAN dulu, baru code** (Plan Mode), ini pattern yang direkomendasikan untuk perubahan non-trivial di Cursor.[^3][^4]
- Di prompt, selalu: _Goal → Context → Constraints → Output format → “Plan only first”_.[^3]

***

## 2. Master system prompt (bisa dipakai di semua agent)

Ini bisa kamu jadikan template / `.cursorrules` atau tempel di awal sesi tiap agent:

```text
You are an expert TypeScript / Solana / Web3 engineer working inside a real repository.

General rules:
- Follow the existing project structure and naming conventions.
- Prefer incremental changes over rewrites.
- Keep code type-safe with strict TypeScript.
- Add or update minimal tests needed for confidence.
- Keep commits and edits small and reviewable.

Workflow rules:
1) First, investigate the codebase relevant to the task.
2) Then, produce a step-by-step implementation PLAN as a Markdown checklist.
3) Do NOT write or edit code until I explicitly say "implement the plan".
4) When implementing, work in small, coherent steps and keep a running recap of what changed.

Security & quality:
- Handle private keys, secrets, and tokens via environment variables only.
- Avoid introducing any non-documented third-party dependencies without explaining why.
- Prefer clear, predictable control flow over cleverness.
- Add meaningful comments only where the intent is non-obvious.

When you are ready, restate:
- Your understanding of the goal.
- The files/directories you plan to touch.
- The main risks or unknowns you see.
Then output ONLY the PLAN in a Markdown checklist.
```

Kalimat terakhir “PLAN only” sejalan dengan best practice Cursor: minta plan dulu, baru eksekusi setelah kamu approve.[^3][^5]

***

## 3. Prompt Agent 1 – Private MPP MagicBlock SDK

Gunakan ini di satu agent/branch khusus untuk paket `@daemon/private-mpp-magicblock` (klien PER + helper):

```text
Goal:
Implement a typed TypeScript SDK for MagicBlock Private Ephemeral Rollups (PER) Private Payments API, named @daemon/private-mpp-magicblock.

Context:
- This SDK should wrap the MagicBlock PER Private Payments API at https://payments.magicblock.app.
- Implement client functions for:
  - GET /health
  - GET /v1/spl/challenge
  - POST /v1/spl/login
  - GET /v1/spl/balance
  - GET /v1/spl/private-balance
  - GET /v1/spl/is-mint-initialized
  - POST /v1/spl/initialize-mint
  - POST /v1/spl/deposit
  - POST /v1/spl/withdraw
  - POST /v1/spl/transfer
  - POST /v1/swap/quote and POST /v1/swap/swap
  - POST /mcp
- Expose high-level helpers:
  - ensurePerMintInitialized(...)
  - ensurePerFunding(...)
  - perPrivateTransfer(...)

Constraints:
- Implement in TypeScript with strict typing.
- Use a small HTTP client abstraction (fetch or a tiny wrapper) that is easy to mock in tests.
- Integrate with @solana/web3.js to decode `transactionBase64` and support signing & sending to the correct RPC (base vs PER) based on the `sendTo` field.
- Support both devnet and mainnet via a PerConfig object:
  - cluster: 'devnet' | 'mainnet'
  - apiBaseUrl
  - validator
  - usdcMint

Output format:
- First message: ONLY a detailed implementation PLAN in Markdown:
  - proposed folder/file structure,
  - public API surface of the SDK (TypeScript interfaces and function signatures),
  - how you will handle errors and retries,
  - how you will handle authentication (challenge/login) and bearer tokens,
  - how you will inject Solana connections/signers.
- After I approve the plan, implement it step-by-step, summarizing changes after each step.

Important:
- Do not hardcode secrets or keys.
- Prefer composable, testable functions.
- Add at least a basic test suite for the public API (even if using simple mocks).

Investigate the codebase and outline your implementation approach step-by-step.
Do NOT code yet, just tell.
```

Bagian “Investigate… Do NOT code yet” adalah pattern yang disarankan power-user Cursor untuk kualitas plan yang tinggi.[^5]

***

## 4. Prompt Agent 2 – MPP custom method `per` (`@daemon/private-mpp-mppx`)

Agent ini fokus di integrasi dengan MPP (`mppx`) dan definisi method `per`:

```text
Goal:
Implement a custom MPP payment method "per" on top of the mppx TypeScript SDK, wrapping private USDC payments on MagicBlock PER.

Context:
- Use the Machine Payments Protocol (MPP) concepts:
  - HTTP 402 Payment Required,
  - Challenge -> Credential -> Receipt flow,
  - mppx library: Method.from, Method.toClient, Method.toServer, Mppx.create.
- The underlying settlement rail is the @daemon/private-mpp-magicblock SDK from Agent 1.
- The "per" method should be a `charge` intent payment method that:
  - Requests: amount (decimal string), currency "USDC", perConfig (cluster, validator, mint), merchant (recipientPerAddress).
  - Credentials: payload containing paymentProof with validator, mint, transferQueue, from, to, atomic amount, and optional signature.

Constraints:
- Keep all MPP-related logic isolated in a dedicated package, e.g. packages/private-mpp-mppx.
- Follow the official MPP custom payment-method patterns (similar to Lightning or custom examples).
- Implement:
  - Method definition (schemas for request and credential payload).
  - Client: createCredential logic
    - initialize PER mint if needed,
    - ensure PER is funded via deposit,
    - perform a private transfer to merchant,
    - build paymentProof and Credential.
  - Server: request + verify logic
    - normalize amount,
    - attach perConfig,
    - verify paymentProof against challenge and (optionally) on-chain data or private balances.

Output format:
- First: produce a PLAN ONLY in Markdown that covers:
  - Types for paymentProof and request payload.
  - Method.from configuration.
  - How Method.toClient will orchestrate calls to the MagicBlock SDK.
  - How Method.toServer will verify the payment.
  - How this package will be exported and consumed by a server that uses Mppx.create.
- After approval, implement in small steps, explaining each change.

Investigate the repo for any existing MPP or payment-related code and align with its patterns.
Do NOT start coding until I say "implement the plan".
```


***

## 5. Prompt Agent 3 – OpenRouter Agent Skill (`@daemon/private-mpp-agent-skill`)

Agent ini yang bangun SKILL/tools untuk Agent OpenRouter:

```text
Goal:
Create an OpenRouter Agent skill package "@daemon/private-mpp-agent-skill" that exposes tools for Private MPP payments on MagicBlock PER.

Context:
- We use OpenRouter's Agent SDK and SKILL conventions (from SKILL.md and docs).
- The skill should provide tools that use:
  - @daemon/private-mpp-magicblock SDK for PER operations.
  - @daemon/private-mpp-mppx "per" payment method for MPP payments.
- Tools to implement (initial set):
  - per_get_quote(merchantId, sku, quantity)
  - per_pay_invoice(quoteId | amount, merchantId)
  - per_get_private_balance(address, mint)
  - per_deposit(address, amount)
  - per_withdraw(address, amount)

Constraints:
- Follow the recommended pattern for tools in OpenRouter Agent SDK (tool definitions with input/output schemas).
- Tools should:
  - Be idempotent where possible.
  - Return structured JSON results that the agent can reason over.
  - Surface clear error messages without leaking secrets.
- Skill package must export:
  - A function to register these tools with an existing Agent.
  - Types for tool inputs/outputs.

Output format:
- First: output a PLAN ONLY in Markdown that describes:
  - Package layout and public exports.
  - Tool definitions and TypeScript types.
  - How tools call into the MagicBlock SDK and the MPP "per" method.
  - How config (cluster, validator, RPC URLs, keys) is passed in (e.g. via env or injected config object).
- After plan approval, implement step-by-step and summarize code changes.

Investigate any existing agent-related code (if present) and align with its patterns.
Do NOT write code before the plan is approved.
```


***

## 6. Prompt Agent 4 – Next.js landing page \& docs

Agent ini tangani frontend \& dokumentasi:

```text
Goal:
Build a Next.js-based landing page and documentation site for the Private MPP + MagicBlock PER project.

Context:
- Tech stack: Next.js (App Router), TypeScript, Tailwind (or your UI library of choice), MDX or a docs framework (e.g., Nextra).
- Content sections for the marketing site:
  - Hero explaining Private MPP on MagicBlock PER.
  - What is PER (private ephemeral rollups, gasless, compliant privacy).
  - What is MPP and how the "per" payment method works.
  - Agent and marketplace integrations (OpenRouter, MCP, Amazon/Airbnb/Shopify/Nomadz-style).
- Docs:
  - Quickstart: Devnet setup, first private payment.
  - SDK reference summaries: MagicBlock SDK, MPP "per" package, Agent skill.
  - How-to guides for:
    - Integrating Private MPP into an API.
    - Using the OpenRouter Agent tools.
    - Running devnet vs production.

Constraints:
- Keep the site minimal but clean: focus on clarity over design complexity.
- Write developer-focused docs with code examples (TypeScript).
- Do NOT duplicate large chunks of external docs; instead, summarize and link out where appropriate.
- Structure docs so that a new engineer can get from zero to "first private payment" in under 15 minutes.

Output format:
- First: provide a PLAN ONLY in Markdown that includes:
  - Proposed Next.js folder structure (app routes, components, docs structure).
  - List of pages/sections and their purpose.
  - Where and how code examples will be included.
- After I approve, implement incrementally, making sure each step keeps the app buildable.

Investigate any existing frontend/docs code in the repo to align with existing styles.
Do NOT start coding until the plan is approved.
```


***

## 7. Cara orkestrasi multitask di Cursor

- Buat **1 worktree / agent** untuk tiap prompt di atas, supaya perubahan tidak saling injak.[^4][^2]
- Jalankan semua dengan pola sama: **tempel Master system prompt → tempel prompt agent spesifik → minta PLAN dulu → review \& edit PLAN (kalau perlu) → baru “Implement the plan, step 1 only…”**.[^3][^5]
- Setelah tiap agent selesai, review diff per worktree dan merge manual ke branch utama (atau pakai fitur “Apply changes” per agent) untuk menjaga kontrol penuh.[^4]

Kalau kamu mau, di langkah berikutnya kita bisa refine masing-masing prompt jadi versi yang benar-benar tailored ke struktur repo-mu (misalnya setelah repo sudah ada `packages/` dan `apps/`).
<span style="display:none">[^10][^11][^12][^13][^14][^15][^6][^7][^8][^9]</span>

<div align="center">⁂</div>

[^1]: https://www.youtube.com/watch?v=RPZWUzE9YVs

[^2]: https://blog.meetneura.ai/parallel-agent-mode/

[^3]: https://quantumbyte.ai/articles/cursor-prompts

[^4]: https://cursor.com/blog/agent-best-practices

[^5]: https://www.linkedin.com/posts/acossta_cursor-pro-tip-end-your-agent-prompts-with-activity-7303466196509630465--hoJ

[^6]: https://forum.cursor.com/t/multi-tasking-support-in-editor-layout-like-agent-sub-agent-mode/159468

[^7]: https://forum.cursor.com/t/a-tip-for-coding-with-the-agent-getting-better-results/131830

[^8]: https://www.builder.io/blog/cursor-tips

[^9]: https://www.youtube.com/watch?v=Yt2PeE2w17o

[^10]: https://www.youtube.com/watch?v=yIcE-fkfA-s

[^11]: https://skywork.ai/blog/vibecoding/multi-agents-full-stack-projects/

[^12]: https://www.reddit.com/r/cursor/comments/1o7eukm/what_are_your_best_cursor_tactics_prompt_habits/

[^13]: https://cursor.com/learn/agents

[^14]: https://www.youtube.com/watch?v=If3ObYwFepQ

[^15]: https://forum.cursor.com/t/multi-agent-collaboration-in-cursor/139051

