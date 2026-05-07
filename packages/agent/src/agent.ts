import { OpenRouter } from '@openrouter/sdk';
import { PerPaymentClient, createPerClientFromEnv } from '@private-mpp/per-client';
import { createPerTools } from './tools.js';

export type PrivateMppAgentOptions = {
  openRouterApiKey?: string;
  perClient?: PerPaymentClient;
};

/**
 * Thin OpenRouter + PER wiring. Uses chat completions with tool definitions;
 * invoke callbacks are executed in this process — sandbox for untrusted inputs in production.
 */
export class PrivateMppAgent {
  readonly per: PerPaymentClient;
  readonly openrouter: OpenRouter | null;
  private readonly toolPack: ReturnType<typeof createPerTools>;

  constructor(opts: PrivateMppAgentOptions = {}) {
    this.per = opts.perClient ?? createPerClientFromEnv();
    this.openrouter = opts.openRouterApiKey
      ? new OpenRouter({ apiKey: opts.openRouterApiKey })
      : process.env.OPENROUTER_API_KEY
        ? new OpenRouter({ apiKey: process.env.OPENROUTER_API_KEY })
        : null;
    this.toolPack = createPerTools(this.per);
  }

  get toolDefinitions() {
    return this.toolPack.tools.map((t) => ({
      type: 'function' as const,
      function: t.function,
    }));
  }

  /** Run tool by name with JSON args — validates with Zod inside tools */
  async runTool(name: string, args: unknown): Promise<unknown> {
    const hit = this.toolPack.tools.find((t) => t.function.name === name);
    if (!hit) throw new Error(`Unknown tool: ${name}`);
    return hit.invoke(args);
  }

  /** Optional one-shot chat when OPENROUTER_API_KEY is set */
  async chat(userMessage: string) {
    if (!this.openrouter) {
      throw new Error('OpenRouter client not configured; set OPENROUTER_API_KEY');
    }
    return this.openrouter.chat.send({
      chatRequest: {
        model: process.env.OPENROUTER_MODEL ?? 'openai/gpt-4o-mini',
        messages: [{ role: 'user', content: userMessage }],
        tools: this.toolDefinitions,
      },
    });
  }
}
