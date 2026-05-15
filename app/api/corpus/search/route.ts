import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { embed } from "@/lib/embeddings";
import { searchCorpus } from "@/lib/qdrant";
import { z } from "zod";

const Schema = z.object({
  query: z.string().min(2).max(2000),
  topK: z.number().int().min(1).max(20).default(10),
  abreviaturas: z.array(z.string()).optional(),
  tipos: z.array(z.string()).optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid", details: parsed.error.flatten() }, { status: 400 });
  }
  const { query, topK, abreviaturas, tipos } = parsed.data;

  try {
    const vec = await embed(query);
    const hits = await searchCorpus(vec, topK, { abreviaturas, tipos });
    return NextResponse.json({ hits });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
