import OpenAI from "openai";
import type {
  LLMCompletionOptions,
  LLMCompletionResult,
  LLMProvider,
} from "./types";

/**
 * DeepSeek provider via OpenAI-compatible API.
 * NO usar para datos confidenciales de clientes — endpoint en China.
 * Usar solo para queries no-sensibles (búsqueda corpus, queries hipotéticas).
 */
export class DeepSeekProvider implements LLMProvider {
  readonly name = "deepseek";
  readonly defaultModel: string;
  private client: OpenAI;

  constructor(apiKey: string, defaultModel = "deepseek-chat") {
    this.client = new OpenAI({
      apiKey,
      baseURL: "https://api.deepseek.com/v1",
    });
    this.defaultModel = defaultModel;
  }

  async complete(options: LLMCompletionOptions): Promise<LLMCompletionResult> {
    const model = options.model ?? this.defaultModel;
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    if (options.systemPrompt) {
      messages.push({ role: "system", content: options.systemPrompt });
    }
    for (const m of options.messages) {
      messages.push({ role: m.role as "user" | "assistant" | "system", content: m.content });
    }

    const resp = await this.client.chat.completions.create({
      model,
      max_tokens: options.maxTokens ?? 4096,
      temperature: options.temperature ?? 0.2,
      messages,
    });

    const choice = resp.choices[0];
    return {
      text: choice.message.content ?? "",
      model,
      stopReason: choice.finish_reason,
      usage: {
        inputTokens: resp.usage?.prompt_tokens ?? 0,
        outputTokens: resp.usage?.completion_tokens ?? 0,
      },
    };
  }
}
