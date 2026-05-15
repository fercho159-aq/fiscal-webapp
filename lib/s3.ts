import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const ENDPOINT = process.env.S3_ENDPOINT ?? "http://localhost:9000";
const REGION = process.env.S3_REGION ?? "us-east-1";
const BUCKET = process.env.S3_BUCKET ?? "fiscal-docs";
const ACCESS_KEY = process.env.MINIO_ROOT_USER ?? "fiscal-admin";
const SECRET_KEY = process.env.MINIO_ROOT_PASSWORD ?? "";

export const s3 = new S3Client({
  region: REGION,
  endpoint: ENDPOINT,
  forcePathStyle: true,
  credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY },
});

let bucketReady = false;

async function ensureBucket(): Promise<void> {
  if (bucketReady) return;
  try {
    await s3.send(new HeadBucketCommand({ Bucket: BUCKET }));
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: BUCKET }));
  }
  bucketReady = true;
}

export async function presignedPutUrl(
  key: string,
  contentType: string,
  expiresInSec = 600
): Promise<string> {
  await ensureBucket();
  const cmd = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(s3, cmd, { expiresIn: expiresInSec });
}

export async function presignedGetUrl(key: string, expiresInSec = 3600): Promise<string> {
  await ensureBucket();
  const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(s3, cmd, { expiresIn: expiresInSec });
}

export async function downloadObject(key: string): Promise<Buffer> {
  await ensureBucket();
  const resp = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  if (!resp.Body) throw new Error(`Empty body for ${key}`);
  const chunks: Buffer[] = [];
  for await (const chunk of resp.Body as AsyncIterable<Buffer>) chunks.push(chunk);
  return Buffer.concat(chunks);
}

export async function deleteObject(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

export function buildDocumentKey(userId: string, casoId: string, filename: string): string {
  const safe = filename.replace(/[^\w.\-]/g, "_");
  const stamp = Date.now();
  return `users/${userId}/casos/${casoId}/${stamp}-${safe}`;
}
