import { QdrantClient } from "@qdrant/js-client-rest";

export const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL ?? "http://localhost:6333",
  apiKey: process.env.QDRANT_API_KEY,
});

export const COLLECTION = process.env.QDRANT_COLLECTION ?? "fiscal_mx";

export interface CorpusHit {
  score: number;
  itemId: string;
  nombreOficial: string;
  abreviatura: string;
  tipo: string;
  label: string; // "Art. 17-A" o "Regla 2.7.1.21"
  text: string;
  urlOficial?: string;
  ultimaReforma?: string;
}

export interface SearchFilters {
  tipos?: string[];           // ej. ["ley_federal", "jurisprudencia"]
  abreviaturas?: string[];    // ej. ["CFF", "LFPCA"]
  tagsMateria?: string[];     // ej. ["ISR", "Procesal"]
}

export async function searchCorpus(
  vector: number[],
  limit = 8,
  filters: SearchFilters = {}
): Promise<CorpusHit[]> {
  const must: Array<Record<string, unknown>> = [];
  if (filters.tipos?.length) must.push({ key: "tipo", match: { any: filters.tipos } });
  if (filters.abreviaturas?.length) must.push({ key: "abreviatura", match: { any: filters.abreviaturas } });
  if (filters.tagsMateria?.length) must.push({ key: "tags_materia", match: { any: filters.tagsMateria } });

  const result = await qdrant.search(COLLECTION, {
    vector,
    limit,
    with_payload: true,
    filter: must.length ? { must } : undefined,
  });

  return result.map((hit) => {
    const p = (hit.payload ?? {}) as Record<string, unknown>;
    return {
      score: hit.score,
      itemId: String(p.item_id ?? ""),
      nombreOficial: String(p.nombre_oficial ?? ""),
      abreviatura: String(p.abreviatura ?? ""),
      tipo: String(p.tipo ?? ""),
      label: String(p.label ?? ""),
      text: String(p.text ?? ""),
      urlOficial: p.url_oficial ? String(p.url_oficial) : undefined,
      ultimaReforma: p.ultima_reforma_dof ? String(p.ultima_reforma_dof) : undefined,
    };
  });
}
