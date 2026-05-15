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

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  const casoId = String(form.get("casoId") ?? "");
  const tipoDocumento = String(form.get("tipoDocumento") ?? "OTRO");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "no_file" }, { status: 400 });
  }
  if (!casoId) {
    return NextResponse.json({ error: "no_caso" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "file_too_big", maxBytes: MAX_BYTES }, { status: 413 });
  }
  if (!TIPOS.has(tipoDocumento)) {
    return NextResponse.json({ error: "tipo_invalido" }, { status: 400 });
  }

  const caso = await prisma.caso.findFirst({
    where: { id: casoId, userId },
    select: { id: true },
  });
  if (!caso) return NextResponse.json({ error: "caso_not_found" }, { status: 404 });

  await ensureBucket();

  const filename = file.name || "documento.pdf";
  const key = buildDocumentKey(userId, casoId, filename);
  const mimeType = file.type || "application/pdf";

  // Stream el archivo a MinIO (desde server interno → MinIO interno, sin pasar por browser)
  const buffer = Buffer.from(await file.arrayBuffer());
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: mimeType,
    ContentLength: buffer.length,
  }));

  // Registrar Documento en DB
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

export const maxDuration = 60;
export const runtime = "nodejs";
