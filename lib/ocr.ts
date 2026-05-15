const OCR_URL = process.env.OCR_URL ?? "http://ocr:8000";

export interface OcrResult {
  text: string;
  pages: number;
  chars: number;
  engine: string;
}

export async function runOcr(buffer: Buffer, filename: string): Promise<OcrResult> {
  const form = new FormData();
  const blob = new Blob([new Uint8Array(buffer)], { type: "application/pdf" });
  form.append("file", blob, filename);

  const res = await fetch(`${OCR_URL}/ocr`, { method: "POST", body: form });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`OCR worker error ${res.status}: ${txt}`);
  }
  return res.json();
}

export async function ocrHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${OCR_URL}/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}
