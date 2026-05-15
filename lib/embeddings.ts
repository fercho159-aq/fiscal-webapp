import OpenAI from "openai";

let client: OpenAI | null = null;

function isKeyValid(key: string | undefined): key is string {
  return !!key && key.startsWith("sk-") && !key.includes("xxx") && key.length > 12;
}

export function embeddingsEnabled(): boolean {
  return isKeyValid(process.env.OPENAI_API_KEY);
}

function getClient(): OpenAI {
  if (!embeddingsEnabled()) {
    throw new Error("OPENAI_API_KEY no configurada — RAG deshabilitado");
  }
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  }
  return client;
}

const MODEL = process.env.EMBEDDING_MODEL ?? "text-embedding-3-large";

export async function embed(text: string): Promise<number[]> {
  const resp = await getClient().embeddings.create({ model: MODEL, input: text });
  return resp.data[0].embedding;
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const resp = await getClient().embeddings.create({ model: MODEL, input: texts });
  return resp.data.map((d) => d.embedding);
}
