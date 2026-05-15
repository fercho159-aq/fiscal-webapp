export type LLMRole = "user" | "assistant" | "system";

export interface LLMMessage {
  role: LLMRole;
  content: string;
}

export interface LLMCompletionOptions {
  systemPrompt?: string;
  messages: LLMMessage[];
  maxTokens?: number;
  temperature?: number;
  model?: string;
  stream?: boolean;
}

export interface LLMUsage {
  inputTokens: number;
  outputTokens: number;
  totalCostUsd?: number;
}

export interface LLMCompletionResult {
  text: string;
  model: string;
  usage: LLMUsage;
  stopReason?: string;
}

export interface LLMStreamChunk {
  delta: string;
  done: boolean;
  usage?: LLMUsage;
}

export interface LLMProvider {
  readonly name: string;
  readonly defaultModel: string;
  complete(options: LLMCompletionOptions): Promise<LLMCompletionResult>;
  stream?(options: LLMCompletionOptions): AsyncIterable<LLMStreamChunk>;
}

export type LLMTier = "default" | "deep" | "fast" | "cheap";
