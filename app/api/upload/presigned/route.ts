import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { presignedPutUrl, buildDocumentKey } from "@/lib/s3";
import { z } from "zod";

const Schema = z.object({
  casoId: z.string(),
  filename: z.string(),
  mimeType: z.string(),
  tamanoBytes: z.number().int().positive().max(20 * 1024 * 1024),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid", details: parsed.error.flatten() }, { status: 400 });
  }

  const { casoId, filename, mimeType, tamanoBytes } = parsed.data;

  const caso = await prisma.caso.findFirst({
    where: { id: casoId, userId: session.user.id },
    select: { id: true },
  });
  if (!caso) return NextResponse.json({ error: "caso_not_found" }, { status: 404 });

  const key = buildDocumentKey(session.user.id, casoId, filename);
  const uploadUrl = await presignedPutUrl(key, mimeType, 600);

  return NextResponse.json({ uploadUrl, key, expiresIn: 600, mimeType, tamanoBytes });
}
