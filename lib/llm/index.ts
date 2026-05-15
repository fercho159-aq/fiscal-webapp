import { ClaudeProvider } from "./claude";
import { DeepSeekProvider } from "./deepseek";
import type { LLMProvider, LLMTier } from "./types";

export * from "./types";

/**
 * Router de proveedores por "tier".
 *
 * - default → Claude Sonnet 4.6 (síntesis, chat, RAG)
 * - deep    → Claude Opus 4.7 (análisis profundo expediente complejo)
 * - fast    → Claude Haiku 4.5 (clasificación rápida, OCR cleanup)
 * - cheap   → DeepSeek V3 (búsqueda corpus, queries no-sensibles)
 *
 * Datos confidenciales de clientes (RFC, montos, oficios SAT) → SIEMPRE Claude.
 * DeepSeek solo para queries hipotéticas / educativas.
 */
export function getLLM(tier: LLMTier = "default"): LLMProvider {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const deepseekKey = process.env.DEEPSEEK_API_KEY;

  switch (tier) {
    case "deep":
      if (!anthropicKey) throw new Error("ANTHROPIC_API_KEY no configurada");
      return new ClaudeProvider(anthropicKey, "claude-opus-4-7");

    case "fast":
      if (!anthropicKey) throw new Error("ANTHROPIC_API_KEY no configurada");
      return new ClaudeProvider(anthropicKey, "claude-haiku-4-5-20251001");

    case "cheap":
      if (deepseekKey) return new DeepSeekProvider(deepseekKey, "deepseek-chat");
      // Fallback a Sonnet si DeepSeek no configurado
      if (!anthropicKey) throw new Error("ANTHROPIC_API_KEY no configurada");
      return new ClaudeProvider(anthropicKey, "claude-sonnet-4-6");

    case "default":
    default:
      if (!anthropicKey) throw new Error("ANTHROPIC_API_KEY no configurada");
      return new ClaudeProvider(anthropicKey, "claude-sonnet-4-6");
  }
}
