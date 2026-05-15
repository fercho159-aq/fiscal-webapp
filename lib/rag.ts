import { embed, embeddingsEnabled } from "./embeddings";
import { searchCorpus, type CorpusHit, type SearchFilters } from "./qdrant";

export interface RagContext {
  query: string;
  hits: CorpusHit[];
  contextoMarkdown: string;
}

/**
 * Recupera fragmentos relevantes del corpus para un texto de consulta.
 * Si el texto es muy largo (>2000 chars), usa los primeros 1500 + extracto.
 */
export async function retrieveContext(
  query: string,
  options: { topK?: number; filters?: SearchFilters } = {}
): Promise<RagContext> {
  // Si OpenAI no está configurado, salta RAG silenciosamente
  if (!embeddingsEnabled()) {
    return {
      query,
      hits: [],
      contextoMarkdown: "_(RAG deshabilitado: OPENAI_API_KEY no configurada)_",
    };
  }

  const { topK = 8, filters } = options;
  const queryTrunc = query.length > 2000 ? query.slice(0, 1500) + "\n...\n" + query.slice(-300) : query;

  try {
    const vector = await embed(queryTrunc);
    const hits = await searchCorpus(vector, topK, filters);
    const contextoMarkdown = formatContextMarkdown(hits);
    return { query, hits, contextoMarkdown };
  } catch (e) {
    console.warn("RAG failed, continuando sin contexto:", e instanceof Error ? e.message : e);
    return {
      query,
      hits: [],
      contextoMarkdown: "_(RAG no disponible en esta consulta)_",
    };
  }
}

function formatContextMarkdown(hits: CorpusHit[]): string {
  if (hits.length === 0) return "_(sin contexto recuperado del corpus)_";
  return hits
    .map((h, i) => {
      const score = h.score.toFixed(3);
      const ref = h.label ? ` — **${h.label}**` : "";
      const reforma = h.ultimaReforma ? ` _(reforma ${h.ultimaReforma})_` : "";
      return `### [${i + 1}] ${h.abreviatura} ${h.nombreOficial}${ref}${reforma} (score: ${score})

${h.text.trim()}

${h.urlOficial ? `Fuente: ${h.urlOficial}` : ""}`.trim();
    })
    .join("\n\n---\n\n");
}

/**
 * Heurística para inferir filtros de búsqueda a partir del texto del documento.
 * Si el oficio menciona "TFJA" busca preferentemente en jurisprudencia TFJA + LFPCA + Amparo.
 */
export function inferFilters(documentText: string): SearchFilters {
  const t = documentText.toLowerCase();
  const abreviaturas: string[] = [];

  if (/\bsat\b|cobro coactivo|inmovilizaci[oó]n|cr[eé]dito fiscal|recargos/i.test(documentText)) {
    abreviaturas.push("CFF", "LISR", "LIVA", "RMF");
  }
  if (/\btfja\b|suspensi[oó]n|juicio.*nulidad|incidente/i.test(documentText)) {
    abreviaturas.push("LFPCA", "LOTFJA");
  }
  if (/amparo|art\.\s*1[02][37]|garant[ií]a.*inter[eé]s/i.test(documentText)) {
    abreviaturas.push("LA-Amp");
  }
  if (/aduan|importaci|exportaci|pedimento/i.test(documentText)) {
    abreviaturas.push("LA", "RLA", "RGCE");
  }
  if (/n[oó]mina|salario|imss|infonavit/i.test(documentText)) {
    abreviaturas.push("LSS", "LINFONAVIT");
  }
  if (/cfdi|comprobante.*fiscal/i.test(documentText)) {
    abreviaturas.push("A20-RMF");
  }

  if (abreviaturas.length === 0) return {};
  return { abreviaturas: [...new Set(abreviaturas)] };
}
