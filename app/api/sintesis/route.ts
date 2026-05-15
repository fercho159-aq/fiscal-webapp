import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { generarSintesis } from "@/lib/sintesis";
import { z } from "zod";

const Schema = z.object({
  casoId: z.string(),
  tipo: z.enum(["EJECUTIVA", "PROFUNDA", "ESTRATEGIA_DEFENSA"]),
  tier: z.enum(["default", "deep", "fast"]).default("default"),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await generarSintesis({
      casoId: parsed.data.casoId,
      tipo: parsed.data.tipo,
      tier: parsed.data.tier,
      userId: session.user.id,
    });
    return NextResponse.json({
      sintesisId: result.id,
      modelo: result.modelo,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "error desconocido";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export const maxDuration = 300; // 5 min para análisis profundo
