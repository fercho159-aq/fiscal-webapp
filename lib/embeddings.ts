import OpenAI from "openai";

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY no configurada");
    client = new OpenAI({ apiKey });
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
