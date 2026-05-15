import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const CreateSchema = z.object({
  casoId: z.string(),
  nombre: z.string().min(1).max(255),
  storageKey: z.string(),
  mimeType: z.string(),
  tamanoBytes: z.number().int().positive(),
  tipoDocumento: z.enum([
    "OFICIO_SAT",
    "RESOLUCION_TFJA",
    "ACUERDO_SUSPENSION",
    "DEMANDA_NULIDAD",
    "AMPARO",
    "CONTESTACION",
    "REQUERIMIENTO",
    "NOTIFICACION",
    "ACTO_ADMINISTRATIVO",
    "OTRO",
  ]).default("OTRO"),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid", details: parsed.error.flatten() }, { status: 400 });
  }

  const caso = await prisma.caso.findFirst({
    where: { id: parsed.data.casoId, userId: session.user.id },
    select: { id: true },
  });
  if (!caso) return NextResponse.json({ error: "caso_not_found" }, { status: 404 });

  const doc = await prisma.documento.create({
    data: {
      casoId: parsed.data.casoId,
      nombre: parsed.data.nombre,
      storageKey: parsed.data.storageKey,
      mimeType: parsed.data.mimeType,
      tamanoBytes: parsed.data.tamanoBytes,
      tipoDocumento: parsed.data.tipoDocumento,
    },
  });
  return NextResponse.json({ id: doc.id });
}
