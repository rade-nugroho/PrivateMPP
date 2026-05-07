<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# refine

Berikut versi yang sudah di-“distill”: lebih pendek, tajam, dan langsung bisa kamu copy‑paste ke Cursor (plus varian per‑agent). Referensinya mengikuti pola goal/context/constraints/output + “plan first” yang disarankan guide advanced Cursor.[^1][^2]

***

## 1. Global `.cursorrules` (opsional tapi sangat dianjurkan)

Taruh ini di root sebagai `.cursorrules` atau `.cursor/rules/private-mpp.mdc` (kalau mau di-scope). Disusun supaya tidak terlalu panjang (<200 baris seperti best practice).[^3]

```text
You are a Senior TypeScript, Solana, and Web3 engineer working in a production repository.

General conventions:
- Use TypeScript with strict types.
- Prefer small, composable functions over large ones.
- Keep public APIs stable and explicit.
- Never hardcode keys, RPC URLs, or secrets. Always use environment variables.
- For Solana:
  - Use @solana/web3.js for signing and transaction handling.
  - Treat transactionBase64 as canonical input from MagicBlock PER.

Workflow:
- For any non-trivial change (multiple files or new features), FIRST produce a step-by-step PLAN in Markdown.
- Only write code after I explicitly confirm the plan.
- Work in small, reviewable steps and always summarize what changed.

Context usage:
- Use Cursor's search to discover relevant files; don't assume the prompt lists everything.[web:21]
- If I mention specific files or folders with @, treat them as the source of truth.[web:18]

Quality:
- Add or update tests when touching critical paths.
- Prefer explicit error handling over silent failures.
- Keep logs minimal and security-safe (no secrets).

When in doubt:
- Ask for clarification instead of guessing.
```


***

## 2. Pola prompt generik per‑task (bisa dipakai berulang)

Template yang bisa kamu pakai untuk _any feature_ terkait Private MPP:

```text
Goal:
Implement <FEATURE> for the Private MPP project (MagicBlock PER + MPP + OpenRouter agents).

Context:
- Core domain: private payments on MagicBlock PER via Private Payments API and MPP "per" payment method.
- Tech stack:
  - TypeScript, Node.js, Solana (@solana/web3.js).
  - MPP / mppx for HTTP 402 (Challenge -> Credential -> Receipt).
  - OpenRouter Agent SDK for tools and agents.
- Relevant folders (if they exist): @packages/private-mpp-magicblock @packages/private-mpp-mppx @packages/private-mpp-agent-skill @apps/private-mpp-example-api @apps/private-mpp-frontend

Constraints:
- Keep code type-safe (strict TypeScript).
- Do not introduce new major deps without a short justification.
- Use environment variables for RPC URLs, keys, and secrets.
- Follow existing patterns and naming in this repo.

Output format:
1) First response: PLAN ONLY in Markdown:
   - overview of approach,
   - files to create/edit,
   - data types or interfaces,
   - potential risks/unknowns.
2) After I approve: implement the plan step by step, summarizing changes after each step.

Activity:
Investigate the codebase and outline your implementation approach step-by-step.
Don't code, just tell.[web:26]
```

Kamu tinggal ganti `<FEATURE>` sesuai fokus (SDK, method MPP, agent skill, frontend, dsb).

***

## 3. Prompt refined per‑agent (lebih pendek)

### Agent 1 – SDK MagicBlock PER

```text
Goal:
Create @daemon/private-mpp-magicblock: a TypeScript SDK for MagicBlock PER Private Payments API.

Context:
- Wrap endpoints: /health, /v1/spl/challenge, /v1/spl/login, /v1/spl/balance, /v1/spl/private-balance, /v1/spl/is-mint-initialized, /v1/spl/initialize-mint, /v1/spl/deposit, /v1/spl/withdraw, /v1/spl/transfer, /v1/swap/quote, /v1/swap/swap, /mcp.
- Provide helpers: ensurePerMintInitialized, ensurePerFunding, perPrivateTransfer.
- Use @solana/web3.js to decode transactionBase64 and sign + send to base or PER RPC.

Constraints:
- TypeScript, strict mode.
- No secrets in code; config via PerConfig { cluster, apiBaseUrl, validator, usdcMint } and injected connections/signers.
- Small HTTP abstraction (fetch wrapper) and basic tests for public API.

Output format:
First: PLAN ONLY (Markdown) with:
- folder/file structure,
- public function signatures,
- error-handling strategy,
- auth handling (challenge/login + bearer token),
- how Solana connections/signers are injected.

Activity:
Investigate the codebase and outline your implementation approach step-by-step.
Don't code, just tell.
```


***

### Agent 2 – MPP `per` method

```text
Goal:
Implement a custom MPP "per" payment method on top of mppx that settles private USDC on MagicBlock PER using the SDK.

Context:
- Use mppx: Method.from, Method.toClient, Method.toServer, Mppx.create.
- Requests: amount (string), currency "USDC", perConfig (cluster, validator, mint), merchant (recipientPerAddress).
- Credential payload: paymentProof { validator, mint, transferQueue, from, to, amountAtomic, signature? }.
- Client should:
  - ensure PER mint initialized,
  - ensure PER funded via deposit,
  - perform private transfer to merchant,
  - build Credential.
- Server should:
  - normalize amount,
  - attach perConfig,
  - verify paymentProof vs challenge and optionally on-chain/per balances.

Constraints:
- Isolate in packages/private-mpp-mppx.
- Clean separation between method definition, client behavior, and server behavior.
- Reuse types from the SDK where possible.

Output format:
First: PLAN ONLY (Markdown) with:
- types/interfaces,
- Method.from schema,
- toClient orchestration steps,
- toServer verification strategy,
- how this package is exported and used by an HTTP API.

Activity:
Investigate the codebase and outline your implementation approach step-by-step.
Don't code, just tell.
```


***

### Agent 3 – OpenRouter Agent Skill

```text
Goal:
Create @daemon/private-mpp-agent-skill: an OpenRouter Agent skill exposing tools for Private MPP payments on PER.

Context:
- Tools should wrap:
  - @daemon/private-mpp-magicblock SDK,
  - MPP "per" method.
- Tools to implement:
  - per_get_quote(merchantId, sku, quantity)
  - per_pay_invoice(quoteId | amount, merchantId)
  - per_get_private_balance(address, mint)
  - per_deposit(address, amount)
  - per_withdraw(address, amount)
- Follow OpenRouter Agent SDK tool patterns (typed input/output, structured JSON).

Constraints:
- All config (cluster, validator, RPC URLs, keys) should come from injected config/env, not hardcoded.
- Tools must be deterministic, with clear success/error structures.

Output format:
First: PLAN ONLY (Markdown) with:
- package layout & exports,
- tool signatures (input/output types),
- how each tool uses SDK + MPP "per",
- how config and keys flow into the skill.

Activity:
Investigate the codebase and outline your implementation approach step-by-step.
Don't code, just tell.
```


***

### Agent 4 – Next.js landing \& docs

```text
Goal:
Build a Next.js landing page + docs site for the Private MPP + MagicBlock PER project.

Context:
- Stack: Next.js App Router + TypeScript + Tailwind (or chosen UI lib) + MDX/docs framework.
- Marketing sections:
  - Hero: Private MPP on MagicBlock PER.
  - What is PER (gasless, private, compliant).
  - What is MPP & "per" method.
  - Agent + marketplace integrations.
- Docs:
  - Quickstart (Devnet setup + first private payment).
  - SDK overviews (MagicBlock SDK, MPP "per", Agent skill).
  - How-to guides for API, agents, MCP/x402.

Constraints:
- Keep design clean and minimal.
- Focus on clear, copy-pasteable TypeScript examples.
- Do not copy external docs; summarize and link.

Output format:
First: PLAN ONLY (Markdown) with:
- app/ route structure and pages,
- main sections per page,
- where code examples live and how they are organized.

Activity:
Investigate the codebase and outline your implementation approach step-by-step.
Don't code, just tell.
```


***

Dengan paket prompt di atas:

- Kamu bisa reuse pola “Goal / Context / Constraints / Output / Activity” yang recommended untuk Cursor.[^1]
- Tiap agent punya scope yang jelas dan _activity line_ yang eksplisit “Investigate the codebase… Don’t code, just tell” seperti tip power‑user Nico.[^2]

Kalau mau, next step kita bisa tulis versi `.cursor/rules/*.mdc` yang nyambung langsung ke glob (misal satu rule hanya aktif di `packages/private-mpp-magicblock/**`).
<span style="display:none">[^10][^11][^12][^13][^14][^15][^4][^5][^6][^7][^8][^9]</span>

<div align="center">⁂</div>

[^1]: https://quantumbyte.ai/articles/cursor-prompts

[^2]: https://www.linkedin.com/posts/acossta_cursor-pro-tip-end-your-agent-prompts-with-activity-7303466196509630465--hoJ

[^3]: https://thepromptshelf.dev/blog/cursor-rules-examples-templates-2026/

[^4]: https://cursor.com/blog/agent-best-practices

[^5]: https://github.com/digitalchild/cursor-best-practices

[^6]: https://github.com/PatrickJS/awesome-cursorrules

[^7]: https://www.youtube.com/watch?v=Vy7dJKv1EpA

[^8]: https://diligenceai.dev/blog/cursor-agent-template/

[^9]: https://forum.cursor.com/t/good-examples-of-cursorrules-file/4346

[^10]: https://www.builder.io/blog/cursor-tips

[^11]: https://www.youtube.com/watch?v=WVeYLlKOWc0

[^12]: https://forum.cursor.com/t/best-practices-cursorrules/41775

[^13]: https://gist.github.com/aashari/07cc9c1b6c0debbeb4f4d94a3a81339e

[^14]: https://dev.to/anshul_02/mastering-cursor-rules-your-complete-guide-to-ai-powered-coding-excellence-2j5h

[^15]: https://forum.cursor.com/t/a-tip-for-coding-with-the-agent-getting-better-results/131830

