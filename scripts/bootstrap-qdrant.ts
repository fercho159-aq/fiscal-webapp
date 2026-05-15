/**
 * Bootstrap Qdrant collection con metadatos del corpus.
 * NO ingesta texto/embeddings — para eso usar fiscal-legal-mx-agent/scripts/ingest.py
 * que tiene chunking + OCR + Python tools.
 *
 * Este script solo:
 *  1. Crea colección fiscal_mx si no existe (dim según embedding model)
 *  2. Verifica conectividad con Qdrant
 *  3. Imprime estado del corpus
 *
 * Uso: tsx scripts/bootstrap-qdrant.ts
 */
import { QdrantClient } from "@qdrant/js-client-rest";

const URL = process.env.QDRANT_URL ?? "http://localhost:6333";
const API_KEY = process.env.QDRANT_API_KEY;
const COLLECTION = process.env.QDRANT_COLLECTION ?? "fiscal_mx";
const EMB_MODEL = process.env.EMBEDDING_MODEL ?? "text-embedding-3-large";
const EMB_DIM = EMB_MODEL.includes("large") ? 3072 : 1536;

async function main() {
  console.log(`→ Qdrant: ${URL}`);
  console.log(`→ Colección: ${COLLECTION} (dim=${EMB_DIM})`);

  const client = new QdrantClient({ url: URL, apiKey: API_KEY });

  try {
    const list = await client.getCollections();
    const exists = list.collections.some((c) => c.name === COLLECTION);

    if (!exists) {
      console.log(`creando colección ${COLLECTION}...`);
      await client.createCollection(COLLECTION, {
        vectors: { size: EMB_DIM, distance: "Cosine" },
      });
      console.log("✓ colección creada");
    } else {
      console.log("✓ colección ya existe");
    }

    const info = await client.getCollection(COLLECTION);
    console.log(`✓ status: ${info.status}`);
    console.log(`✓ vectors_count: ${info.points_count ?? 0}`);

    // Crear índices payload para filtros frecuentes
    const indexFields = ["tipo", "abreviatura", "categoria", "tags_materia"];
    for (const field of indexFields) {
      try {
        await client.createPayloadIndex(COLLECTION, { field_name: field, field_schema: "keyword" });
        console.log(`✓ índice payload: ${field}`);
      } catch (e) {
        if (e instanceof Error && e.message.includes("already exists")) continue;
        console.warn(`  ⚠ no se pudo crear índice ${field}`);
      }
    }

    console.log("\n✓ bootstrap completo");
    if ((info.points_count ?? 0) === 0) {
      console.log("\nSiguiente paso: ingestar corpus con");
      console.log("  cd ../fiscal-legal-mx-agent");
      console.log("  bash scripts/download_corpus.sh");
      console.log("  docker compose --profile ingest run --rm ingest");
    }
  } catch (e) {
    console.error("ERROR:", e instanceof Error ? e.message : e);
    process.exit(1);
  }
}

main();
