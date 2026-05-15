import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { qdrant, COLLECTION } from "@/lib/qdrant";
import { s3 } from "@/lib/s3";
import { HeadBucketCommand } from "@aws-sdk/client-s3";
import { ocrHealth } from "@/lib/ocr";

const BUCKET = process.env.S3_BUCKET ?? "fiscal-docs";

export async function GET() {
  const checks: Record<string, { ok: boolean; ms: number; detail?: string }> = {};

  async function check(name: string, fn: () => Promise<unknown>): Promise<void> {
    const t0 = Date.now();
    try {
      await fn();
      checks[name] = { ok: true, ms: Date.now() - t0 };
    } catch (e) {
      checks[name] = {
        ok: false,
        ms: Date.now() - t0,
        detail: e instanceof Error ? e.message : String(e),
      };
    }
  }

  await Promise.all([
    check("postgres", () => prisma.$queryRaw`SELECT 1`),
    check("qdrant", () => qdrant.getCollection(COLLECTION).catch(() => qdrant.getCollections())),
    check("minio", () => s3.send(new HeadBucketCommand({ Bucket: BUCKET }))),
    check("ocr", async () => {
      const ok = await ocrHealth();
      if (!ok) throw new Error("ocr down");
    }),
    check("anthropic", async () => {
      if (!process.env.ANTHROPIC_API_KEY) throw new Error("missing key");
    }),
  ]);

  const allOk = Object.values(checks).every((c) => c.ok);
  return NextResponse.json(
    { ok: allOk, checks, timestamp: new Date().toISOString() },
    { status: allOk ? 200 : 503 }
  );
}
