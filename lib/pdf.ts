import pdfParse from "pdf-parse";

export interface PdfExtractResult {
  text: string;
  numPages: number;
  isScanned: boolean;
  metadata?: Record<string, unknown>;
}

const SCANNED_TEXT_THRESHOLD = 200; // <200 chars en todo el PDF → probable escaneado

export async function extractPdfText(buffer: Buffer): Promise<PdfExtractResult> {
  const data = await pdfParse(buffer);
  const text = (data.text ?? "").trim();
  return {
    text,
    numPages: data.numpages ?? 0,
    isScanned: text.length < SCANNED_TEXT_THRESHOLD,
    metadata: (data.info as Record<string, unknown>) ?? undefined,
  };
}

/** Detecta datos clave en oficios SAT vía regex (pre-LLM). */
export interface DetectedFields {
  rfc?: string;
  folioUnico?: string;
  expediente?: string;
  oficioNumero?: string;
  montoTotal?: number;
  fechasISO: string[];
  articulosCitados: string[];
}

export function detectFields(text: string): DetectedFields {
  const rfcMatch = text.match(/\b([A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3})\b/);
  const folio = text.match(/Folio\s+(?:[ÚU]nico|de\s+seguimiento)?[:\s]+(\d{6,})/i);
  const exp = text.match(/Exp(?:ediente)?[\.:\s]+([\d\-\/A-Z]+)/i);
  const oficio = text.match(/Oficio\s+(?:No\.?|N[úu]mero)?\s*[:\s]*([\d\-A-Z\/]+)/i);

  const articulos = new Set<string>();
  for (const m of text.matchAll(/Art[íi]culo[s]?\s+(\d+[A-Z\-]?(?:\s*(?:Bis|Ter|Quater|Quinquies))?)/gi)) {
    articulos.add(m[1].replace(/\s+/g, " ").trim());
  }

  const fechasISO = new Set<string>();
  const meses: Record<string, string> = {
    enero: "01", febrero: "02", marzo: "03", abril: "04", mayo: "05", junio: "06",
    julio: "07", agosto: "08", septiembre: "09", octubre: "10", noviembre: "11", diciembre: "12",
  };
  for (const m of text.matchAll(/(\d{1,2})\s+de\s+(\w+)\s+de\s+(?:dos mil\s+\w+|\d{4})/gi)) {
    const dia = m[1].padStart(2, "0");
    const mes = meses[m[2].toLowerCase()];
    if (mes) {
      const yMatch = m[0].match(/(\d{4})$/);
      const ano = yMatch ? yMatch[1] : palabrasANumero(m[0]);
      if (ano) fechasISO.add(`${ano}-${mes}-${dia}`);
    }
  }
  for (const m of text.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) {
    fechasISO.add(`${m[1]}-${m[2]}-${m[3]}`);
  }

  const montos: number[] = [];
  for (const m of text.matchAll(/\$\s*([\d,]+(?:\.\d{2})?)/g)) {
    const n = parseFloat(m[1].replace(/,/g, ""));
    if (!Number.isNaN(n) && n > 1000) montos.push(n);
  }
  const montoTotal = montos.length ? Math.max(...montos) : undefined;

  return {
    rfc: rfcMatch?.[1],
    folioUnico: folio?.[1],
    expediente: exp?.[1],
    oficioNumero: oficio?.[1],
    montoTotal,
    fechasISO: [...fechasISO].sort(),
    articulosCitados: [...articulos].sort(),
  };
}

function palabrasANumero(texto: string): string | null {
  if (/dos mil veintis[eé]is/i.test(texto)) return "2026";
  if (/dos mil veinticinco/i.test(texto)) return "2025";
  if (/dos mil veinticuatro/i.test(texto)) return "2024";
  if (/dos mil veintitr[ée]s/i.test(texto)) return "2023";
  if (/dos mil veintid[oó]s/i.test(texto)) return "2022";
  if (/dos mil veintiuno/i.test(texto)) return "2021";
  if (/dos mil veinte/i.test(texto)) return "2020";
  return null;
}
