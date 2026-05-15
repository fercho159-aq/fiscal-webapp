import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteObject, downloadObject } from "@/lib/s3";

// GET: descarga el archivo via proxy (no expone MinIO al browser)
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const session = await auth();
  if (!session?.user?.id) return new Response("unauthorized", { status: 401 });

  const doc = await prisma.documento.findFirst({
    where: { id, caso: { userId: session.user.id } },
  });
  if (!doc) return new Response("not_found", { status: 404 });

  try {
    const buffer = await downloadObject(doc.storageKey);
    return new Response(buffer as unknown as BodyInit, {
      headers: {
        "Content-Type": doc.mimeType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(doc.nombre)}"`,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (e) {
    return new Response(`download_failed: ${e instanceof Error ? e.message : "error"}`, {
      status: 500,
    });
  }
}

// DELETE: borra registro DB + objeto en MinIO
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const doc = await prisma.documento.findFirst({
    where: { id, caso: { userId: session.user.id } },
  });
  if (!doc) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Borrar de MinIO primero (mejor falle aquí que perder referencia DB)
  try {
    await deleteObject(doc.storageKey);
  } catch (e) {
    console.warn(`MinIO delete falló para ${doc.storageKey}:`, e);
    // Continuar — preferimos limpiar la referencia DB aunque el objeto quede huérfano
  }

  await prisma.documento.delete({ where: { id: doc.id } });

  return NextResponse.json({ ok: true, id: doc.id });
}

export const runtime = "nodejs";
