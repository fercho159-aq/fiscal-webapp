import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { s3, buildDocumentKey } from "@/lib/s3";
import { PutObjectCommand, CreateBucketCommand, HeadBucketCommand } from "@aws-sdk/client-s3";

const BUCKET = process.env.S3_BUCKET ?? "fiscal-docs";
const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

const TIPOS = new Set([
  "OFICIO_SAT", "RESOLUCION_TFJA", "ACUERDO_SUSPENSION", "DEMANDA_NULIDAD",
  "AMPARO", "CONTESTACION", "REQUERIMIENTO", "NOTIFICACION", "ACTO_ADMINISTRATIVO", "OTRO",
]);

async function ensureBucket(): Promise<void> {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: BUCKET }));
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: BUCKET }));
  }
}

/**
 * Upload directo PDF → MinIO sin parsear FormData (bypassa límite Next.js 10MB).
 * Metadata viaja en query params, body es el binary del PDF.
 */
export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const casoId = url.searchParams.get("casoId") ?? "";
  const filename = url.searchParams.get("filename") ?? "documento.pdf";
  const tipoDocumento = url.searchParams.get("tipoDocumento") ?? "OTRO";
  const mimeType = req.headers.get("content-type") ?? "application/pdf";
  const contentLength = parseInt(req.headers.get("content-length") ?? "0", 10);

  if (!casoId) return NextResponse.json({ error: "no_caso" }, { status: 400 });
  if (!TIPOS.has(tipoDocumento)) return NextResponse.json({ error: "tipo_invalido" }, { status: 400 });
  if (contentLength <= 0) return NextResponse.json({ error: "empty_body" }, { status: 400 });
  if (contentLength > MAX_BYTES) {
    return NextResponse.json({ error: "file_too_big", maxBytes: MAX_BYTES }, { status: 413 });
  }

  const caso = await prisma.caso.findFirst({
    where: { id: casoId, userId },
    select: { id: true },
  });
  if (!caso) return NextResponse.json({ error: "caso_not_found" }, { status: 404 });

  await ensureBucket();

  const key = buildDocumentKey(userId, casoId, filename);

  // Stream body directo a buffer y luego a MinIO
  const buffer = Buffer.from(await req.arrayBuffer());

  if (buffer.length === 0) {
    return NextResponse.json({ error: "empty_body" }, { status: 400 });
  }

  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: mimeType,
    ContentLength: buffer.length,
  }));

  const doc = await prisma.documento.create({
    data: {
      casoId,
      nombre: filename,
      storageKey: key,
      mimeType,
      tamanoBytes: buffer.length,
      // @ts-expect-error enum string cast
      tipoDocumento,
    },
  });

  return NextResponse.json({ id: doc.id, storageKey: key });
}

export const maxDuration = 120;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
