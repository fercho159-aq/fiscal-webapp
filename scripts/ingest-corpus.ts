/**
 * Ingesta corpus legal fiscal mexicano a Qdrant.
 * Lee:
 *  - JSONs metadata: ./corpus-metadata/*.json (copiados desde fiscal-legal-mx-agent/research/.../results/)
 *  - PDFs: ./corpus-raw/<item_id>.pdf
 *
 * Genera chunks (artículo / regla compuesta / texto) → embeddings OpenAI → upsert Qdrant.
 *
 * Uso (dentro del container app):
 *   tsx scripts/ingest-corpus.ts [--items=01-CFF,02-LISR]
 */
import { readFileSync, readdirSync, existsSync, statSync } from "fs";
import { join, basename } from "path";
import OpenAI from "openai";
import { QdrantClient } from "@qdrant/js-client-rest";
import pdfParse from "pdf-parse";
import { randomUUID } from "crypto";

const METADATA_DIR = process.env.METADATA_DIR ?? "./corpus-metadata";
const CORPUS_DIR = process.env.CORPUS_DIR ?? "./corpus-raw";
const QDRANT_URL = process.env.QDRANT_URL ?? "http://localhost:6333";
const QDRANT_API_KEY = process.env.QDRANT_API_KEY;
const COLLECTION = process.env.QDRANT_COLLECTION ?? "fiscal_mx";
const EMB_MODEL = process.env.EMBEDDING_MODEL ?? "text-embedding-3-large";
const EMB_DIM = EMB_MODEL.includes("large") ? 3072 : 1536;
const BATCH_SIZE = 96;
const MAX_TOKENS_CHUNK = 1500;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const qdrant = new QdrantClient({ url: QDRANT_URL, apiKey: QDRANT_API_KEY });

const ARTICLE_RE = /(?:^|\n)\s*Art[íi]culo\s+(\d+[A-Z\-]?(?:\s*(?:Bis|Ter))?)\.?-?\s*/gim;
const RMF_RULE_RE = /(?:^|\n)\s*(\d+\.\d+\.\d+\.\d+)\.?\s+/gm;

interface ItemMeta {
  nombre_oficial?: string;
  abreviatura?: string;
  tipo?: string;
  categoria?: string;
  url_oficial?: string;
  ultima_reforma_dof?: string;
  tags_materia?: string[];
  chunking_strategy?: string;
}

async function ensureCollection(): Promise<void> {
  const list = await qdrant.getCollections();
  if (!list.collections.some((c) => c.name === COLLECTION)) {
    await qdrant.createCollection(COLLECTION, {
      vectors: { size: EMB_DIM, distance: "Cosine" },
    });
    console.log(`✓ colección creada ${COLLECTION} dim=${EMB_DIM}`);
  }
}

function chunkByArticle(text: string): Array<{ label: string; content: string }> {
  const matches = [...text.matchAll(ARTICLE_RE)];
  if (matches.length === 0) return [{ label: "doc", content: text }];

  const chunks: Array<{ label: string; content: string }> = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index ?? 0;
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? text.length) : text.length;
    const content = text.slice(start, end).trim();
    if (content) chunks.push({ label: `Art. ${matches[i][1]}`, content });
  }
  return chunks;
}

function chunkByRmfRule(text: string): Array<{ label: string; content: string }> {
  const matches = [...text.matchAll(RMF_RULE_RE)];
  if (matches.length === 0) return chunkByArticle(text);

  const chunks: Array<{ label: string; content: string }> = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index ?? 0;
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? text.length) : text.length;
    chunks.push({ label: `Regla ${matches[i][1]}`, content: text.slice(start, end).trim() });
  }
  return chunks;
}

// Estimación cruda: 1 token ≈ 4 chars en español
function capByTokens(text: string, maxTokens: number): string[] {
  const maxChars = maxTokens * 4;
  if (text.length <= maxChars) return [text];
  const out: string[] = [];
  for (let i = 0; i < text.length; i += maxChars) out.push(text.slice(i, i + maxChars));
  return out;
}

async function embedBatch(texts: string[]): Promise<number[][]> {
  const resp = await openai.embeddings.create({ model: EMB_MODEL, input: texts });
  return resp.data.map((d) => d.embedding);
}

async function extractText(pdfPath: string): Promise<string> {
  const buf = readFileSync(pdfPath);
  const data = await pdfParse(buf);
  return (data.text ?? "").trim();
}

async function ingestItem(itemId: string): Promise<number> {
  const metaPath = join(METADATA_DIR, `${itemId}.json`);
  if (!existsSync(metaPath)) {
    console.log(`  ⚠ sin metadata: ${itemId}`);
    return 0;
  }
  const meta: ItemMeta = JSON.parse(readFileSync(metaPath, "utf8"));

  // Buscar PDF (puede tener extensión .pdf, .html, etc.)
  const candidates = readdirSync(CORPUS_DIR).filter(
    (f) => f.startsWith(itemId) && /\.(pdf|html|txt)$/i.test(f)
  );
  if (candidates.length === 0) {
    console.log(`  ⚠ sin archivo: ${itemId}`);
    return 0;
  }
  const filePath = join(CORPUS_DIR, candidates[0]);

  let text: string;
  if (filePath.endsWith(".pdf")) {
    text = await extractText(filePath);
  } else {
    text = readFileSync(filePath, "utf8");
  }
  if (!text || text.length < 200) {
    console.log(`  ⚠ texto vacío/corto: ${itemId} (${text.length} chars)`);
    return 0;
  }

  const strategy = (meta.chunking_strategy ?? "por_articulo").toLowerCase();
  const chunks = strategy.includes("rmf") || strategy.includes("regla")
    ? chunkByRmfRule(text)
    : chunkByArticle(text);

  const points: Array<{ id: string; vector: number[]; payload: Record<string, unknown> }> = [];
  const batchTexts: string[] = [];
  const batchPayloads: Array<Record<string, unknown>> = [];

  for (const chunk of chunks) {
    for (const sub of capByTokens(chunk.content, MAX_TOKENS_CHUNK)) {
      batchTexts.push(sub);
      batchPayloads.push({
        item_id: itemId,
        nombre_oficial: meta.nombre_oficial,
        abreviatura: meta.abreviatura,
        tipo: meta.tipo,
        categoria: meta.categoria,
        label: chunk.label,
        url_oficial: meta.url_oficial,
        ultima_reforma_dof: meta.ultima_reforma_dof,
        tags_materia: meta.tags_materia,
        text: sub,
      });

      if (batchTexts.length >= BATCH_SIZE) {
        const vecs = await embedBatch(batchTexts);
        for (let i = 0; i < vecs.length; i++) {
          points.push({ id: randomUUID(), vector: vecs[i], payload: batchPayloads[i] });
        }
        batchTexts.length = 0;
        batchPayloads.length = 0;
      }
    }
  }

  if (batchTexts.length > 0) {
    const vecs = await embedBatch(batchTexts);
    for (let i = 0; i < vecs.length; i++) {
      points.push({ id: randomUUID(), vector: vecs[i], payload: batchPayloads[i] });
    }
  }

  if (points.length > 0) {
    // Upsert por batches de 200
    for (let i = 0; i < points.length; i += 200) {
      await qdrant.upsert(COLLECTION, { points: points.slice(i, i + 200), wait: false });
    }
  }
  return points.length;
}

async function main() {
  console.log(`→ Ingestando corpus a ${COLLECTION}`);
  console.log(`  Embedding: ${EMB_MODEL} (${EMB_DIM}d)`);
  console.log(`  Metadata: ${METADATA_DIR}`);
  console.log(`  Corpus:   ${CORPUS_DIR}`);

  if (!existsSync(METADATA_DIR) || !statSync(METADATA_DIR).isDirectory()) {
    throw new Error(`METADATA_DIR no existe: ${METADATA_DIR}`);
  }
  await ensureCollection();

  const onlyArg = process.argv.find((a) => a.startsWith("--items="));
  const only = onlyArg ? onlyArg.split("=")[1].split(",") : null;

  const metaFiles = readdirSync(METADATA_DIR).filter((f) => f.endsWith(".json"));
  const itemIds = (only ?? metaFiles.map((f) => basename(f, ".json"))).sort();

  console.log(`\nItems a procesar: ${itemIds.length}\n`);

  let totalPoints = 0;
  let success = 0;
  let failed = 0;

  for (const id of itemIds) {
    process.stdout.write(`  ${id}... `);
    try {
      const n = await ingestItem(id);
      process.stdout.write(`✓ ${n} puntos\n`);
      totalPoints += n;
      if (n > 0) success++;
    } catch (e) {
      process.stdout.write(`✗ ${e instanceof Error ? e.message : "error"}\n`);
      failed++;
    }
  }

  console.log(`\n✓ INGESTA COMPLETA`);
  console.log(`  ${success} items con contenido`);
  console.log(`  ${failed} items con error`);
  console.log(`  ${totalPoints} embeddings totales`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
