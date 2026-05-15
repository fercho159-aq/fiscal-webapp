import Anthropic from "@anthropic-ai/sdk";
import type {
  LLMCompletionOptions,
  LLMCompletionResult,
  LLMProvider,
  LLMStreamChunk,
} from "./types";

const PRICING: Record<string, { input: number; output: number }> = {
  "claude-opus-4-7": { input: 15, output: 75 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-haiku-4-5-20251001": { input: 0.8, output: 4 },
};

export class ClaudeProvider implements LLMProvider {
  readonly name = "claude";
  readonly defaultModel: string;
  private client: Anthropic;

  constructor(apiKey: string, defaultModel = "claude-sonnet-4-6") {
    this.client = new Anthropic({ apiKey });
    this.defaultModel = defaultModel;
  }

  async complete(options: LLMCompletionOptions): Promise<LLMCompletionResult> {
    const model = options.model ?? this.defaultModel;
    const resp = await this.client.messages.create({
      model,
      max_tokens: options.maxTokens ?? 4096,
      temperature: options.temperature ?? 0.2,
      system: options.systemPrompt,
      messages: options.messages
        .filter((m) => m.role !== "system")
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    });

    const text = resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    const pricing = PRICING[model];
    const costUsd = pricing
      ? (resp.usage.input_tokens * pricing.input + resp.usage.output_tokens * pricing.output) / 1_000_000
      : undefined;

    return {
      text,
      model,
      stopReason: resp.stop_reason ?? undefined,
      usage: {
        inputTokens: resp.usage.input_tokens,
        outputTokens: resp.usage.output_tokens,
        totalCostUsd: costUsd,
      },
    };
  }

  async *stream(options: LLMCompletionOptions): AsyncIterable<LLMStreamChunk> {
    const model = options.model ?? this.defaultModel;
    const stream = this.client.messages.stream({
      model,
      max_tokens: options.maxTokens ?? 4096,
      temperature: options.temperature ?? 0.2,
      system: options.systemPrompt,
      messages: options.messages
        .filter((m) => m.role !== "system")
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        yield { delta: event.delta.text, done: false };
      }
    }

    const final = await stream.finalMessage();
    yield {
      delta: "",
      done: true,
      usage: {
        inputTokens: final.usage.input_tokens,
        outputTokens: final.usage.output_tokens,
      },
    };
  }
}
