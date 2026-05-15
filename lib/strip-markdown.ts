/**
 * Convierte Markdown a texto plano legible.
 * Quita: headers, bold/italic, code, blockquotes, listas, tablas, links, hr.
 * Preserva: contenido textual + saltos de párrafo normalizados.
 */
export function stripMarkdown(input: string): string {
  if (!input) return "";

  let text = input;

  // Tablas: quita filas de separación |---|---|
  text = text.replace(/^\|[\s|:-]+\|\s*$/gm, "");
  // Convierte filas de tabla en texto separado por · (centrado dot)
  text = text.replace(/^\|(.+)\|\s*$/gm, (_m, row: string) =>
    row
      .split("|")
      .map((c) => c.trim())
      .filter(Boolean)
      .join(" · ")
  );

  // Code fences
  text = text.replace(/```[\s\S]*?```/g, " ");
  // Inline code
  text = text.replace(/`([^`]+)`/g, "$1");

  // Headers
  text = text.replace(/^#{1,6}\s+/gm, "");

  // Blockquotes
  text = text.replace(/^>\s?/gm, "");

  // List markers
  text = text.replace(/^\s*[-*+]\s+/gm, "");
  text = text.replace(/^\s*\d+\.\s+/gm, "");

  // Bold / italic
  text = text.replace(/\*\*([^*]+)\*\*/g, "$1");
  text = text.replace(/__([^_]+)__/g, "$1");
  text = text.replace(/\*([^*\n]+)\*/g, "$1");
  text = text.replace(/_([^_\n]+)_/g, "$1");

  // Links / images
  text = text.replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1");

  // Horizontal rules
  text = text.replace(/^[-*_]{3,}\s*$/gm, "");

  // Restos comunes
  text = text.replace(/\|/g, " ");
  text = text.replace(/[ \t]+/g, " ");
  text = text.replace(/\n{3,}/g, "\n\n");

  return text.trim();
}

/**
 * Versión corta — primeros N chars sin markdown + ellipsis.
 */
export function stripMarkdownShort(input: string, maxChars = 220): string {
  const clean = stripMarkdown(input);
  if (clean.length <= maxChars) return clean;
  return clean.slice(0, maxChars).replace(/\s+\S*$/, "") + "…";
}
