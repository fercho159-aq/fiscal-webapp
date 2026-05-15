import { prisma } from "./prisma";
import { downloadObject } from "./s3";
import { extractPdfText, detectFields } from "./pdf";
import { runOcr } from "./ocr";
import { retrieveContext, inferFilters } from "./rag";
import { getLLM, type LLMTier } from "./llm";
import { FISCAL_SYSTEM_PROMPT } from "./llm/system-prompt";
import type { Prisma, TipoSintesis } from "@prisma/client";

export interface SintesisRequest {
  casoId: string;
  tipo: TipoSintesis;
  tier: LLMTier;
  userId: string;
}

export interface SintesisResult {
  id: string;
  contenidoMarkdown: string;
  datosEstructurados: SintesisEstructurada;
  modelo: string;
  tokensIn: number;
  tokensOut: number;
}

export interface SintesisEstructurada {
  caso?: string;
  estadoProcesal?: string;
  adeudoTotal?: number;
  actoImpugnado?: string;
  defensaVigente?: string;
  proximoPlazo?: { fecha: string; accion: string };
  riesgoPrincipal?: string;
  recomendacion?: string;
  fundamentosClave: string[];
  documentosAnalizados: number;
  fechasISO: string[];
  rfcsDetectados: string[];
  expedientesDetectados: string[];
}

export async function generarSintesis(req: SintesisRequest): Promise<SintesisResult> {
  // 1. Cargar caso + documentos
  const caso = await prisma.caso.findFirst({
    where: { id: req.casoId, userId: req.userId },
    include: { documentos: { orderBy: { createdAt: "asc" } } },
  });
  if (!caso) throw new Error("caso no encontrado");
  if (caso.documentos.length === 0) throw new Error("caso sin documentos");

  // 2. Extraer texto de cada documento (cache en textoExtraido)
  const docsConTexto: Array<{ nombre: string; tipo: string; texto: string }> = [];
  for (const doc of caso.documentos) {
    let texto = doc.textoExtraido ?? "";
    if (!texto && doc.mimeType === "application/pdf") {
      const buffer = await downloadObject(doc.storageKey);
      const parsed = await extractPdfText(buffer);
      texto = parsed.text;
      let usedOcr = false;
      if (parsed.isScanned) {
        try {
          const ocrResult = await runOcr(buffer, doc.nombre);
          if (ocrResult.text.length > texto.length) {
            texto = ocrResult.text;
            usedOcr = true;
          }
        } catch (e) {
          console.error("OCR fallback failed", e);
        }
      }
      const detectados = detectFields(texto);
      await prisma.documento.update({
        where: { id: doc.id },
        data: {
          textoExtraido: texto,
          ocrAplicado: usedOcr,
          metadatos: detectados as unknown as Prisma.InputJsonValue,
        },
      });
    }
    if (texto) {
      docsConTexto.push({ nombre: doc.nombre, tipo: doc.tipoDocumento, texto });
    }
  }
  if (docsConTexto.length === 0) {
    throw new Error("ningún documento legible — posiblemente requieren OCR");
  }

  // 3. Consolidar texto para RAG
  const textoConsolidado = docsConTexto
    .map((d) => `--- ${d.tipo} · ${d.nombre} ---\n${d.texto}`)
    .join("\n\n");

  // 4. Recuperar contexto del corpus
  const filtros = inferFilters(textoConsolidado);
  const rag = await retrieveContext(textoConsolidado, { topK: 8, filters: filtros });

  // 5. Pre-detección de datos
  const detectados = detectFields(textoConsolidado);

  // 6. Construir prompt de usuario según tipo
  const userPrompt = construirPrompt({
    caso: {
      titulo: caso.titulo,
      expediente: caso.expedienteNumero,
      rfc: caso.rfcContribuyente,
      razonSocial: caso.razonSocial,
      autoridad: caso.autoridadEmisora,
    },
    documentos: docsConTexto,
    detectados,
    contextoCorpus: rag.contextoMarkdown,
    tipo: req.tipo,
  });

  // 7. Llamar a Claude
  const llm = getLLM(req.tier);
  const resp = await llm.complete({
    systemPrompt: FISCAL_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
    maxTokens: 8192,
    temperature: 0.15,
  });

  // 8. Parsear datos estructurados del markdown
  const estructurada = parsearSintesis(resp.text, {
    docs: docsConTexto.length,
    detectados,
  });

  // 9. Persistir
  const sintesis = await prisma.sintesis.create({
    data: {
      casoId: caso.id,
      tipo: req.tipo,
      contenidoMarkdown: resp.text,
      datosEstructurados: estructurada as unknown as Prisma.InputJsonValue,
      modelo: resp.model,
    },
  });

  // 10. Actualizar caso con datos extraídos si están vacíos
  await prisma.caso.update({
    where: { id: caso.id },
    data: {
      montoTotal: !caso.montoTotal && estructurada.adeudoTotal
        ? estructurada.adeudoTotal
        : undefined,
      estadoProcesal: !caso.estadoProcesal ? estructurada.estadoProcesal : undefined,
      plazoProximo: !caso.plazoProximo && estructurada.proximoPlazo?.fecha
        ? new Date(estructurada.proximoPlazo.fecha)
        : undefined,
      rfcContribuyente: caso.rfcContribuyente ?? detectados.rfc ?? undefined,
      expedienteNumero: caso.expedienteNumero ?? detectados.expediente ?? undefined,
    },
  });

  return {
    id: sintesis.id,
    contenidoMarkdown: resp.text,
    datosEstructurados: estructurada,
    modelo: resp.model,
    tokensIn: resp.usage.inputTokens,
    tokensOut: resp.usage.outputTokens,
  };
}

function construirPrompt(args: {
  caso: { titulo: string; expediente: string | null; rfc: string | null; razonSocial: string | null; autoridad: string | null };
  documentos: Array<{ nombre: string; tipo: string; texto: string }>;
  detectados: ReturnType<typeof detectFields>;
  contextoCorpus: string;
  tipo: TipoSintesis;
}): string {
  const instrucciones: Record<TipoSintesis, string> = {
    EJECUTIVA: `Genera una **síntesis ejecutiva** del expediente. Sigue el protocolo de 7 pasos. Termina con el bloque CASO/ESTADO/ADEUDO/ACTO/DEFENSA/PLAZO/RIESGO/RECOMENDACIÓN.`,
    PROFUNDA: `Genera un **análisis profundo** del expediente. Incluye: tabla completa de créditos fiscales (histórico, actualización, recargos, multas, total), línea de tiempo procesal, evaluación de vicios formales y sustantivos artículo por artículo, opciones de defensa con pros/contras de cada una, escenarios de litigación.`,
    ESTRATEGIA_DEFENSA: `Genera una **estrategia de defensa** completa. Identifica: (1) vías procesales viables ordenadas por probabilidad de éxito, (2) plazos críticos con fechas exactas, (3) garantía del interés fiscal recomendada (post-reforma Amparo 16-10-2025), (4) argumentos sustantivos prioritarios con fundamento, (5) jurisprudencia clave que respalda la defensa, (6) acciones inmediatas (próximas 72 horas).`,
  };

  return `# Datos del caso

- **Título:** ${args.caso.titulo}
- **Expediente:** ${args.caso.expediente ?? "no asignado"}
- **RFC contribuyente:** ${args.caso.rfc ?? "no proporcionado"}
- **Razón social:** ${args.caso.razonSocial ?? "no proporcionada"}
- **Autoridad emisora:** ${args.caso.autoridad ?? "no proporcionada"}

# Datos detectados automáticamente del expediente

- RFC: ${args.detectados.rfc ?? "no detectado"}
- Folio único: ${args.detectados.folioUnico ?? "no detectado"}
- Expediente: ${args.detectados.expediente ?? "no detectado"}
- Oficio número: ${args.detectados.oficioNumero ?? "no detectado"}
- Monto máximo detectado: ${args.detectados.montoTotal ? `$${args.detectados.montoTotal.toLocaleString("es-MX")} MXN` : "no detectado"}
- Fechas detectadas (ISO): ${args.detectados.fechasISO.join(", ") || "ninguna"}
- Artículos citados: ${args.detectados.articulosCitados.join(", ") || "ninguno"}

# Documentos del expediente (${args.documentos.length})

${args.documentos.map((d, i) => `## [${i + 1}] ${d.tipo} — ${d.nombre}\n\n\`\`\`\n${d.texto.slice(0, 8000)}${d.texto.length > 8000 ? "\n[...truncado...]" : ""}\n\`\`\``).join("\n\n")}

# Contexto recuperado del corpus legal (RAG)

${args.contextoCorpus}

# Instrucción

${instrucciones[args.tipo]}

Trabaja con precisión quirúrgica. Cita siempre artículo y ley. Marca plazos urgentes con ⚠️ y fecha exacta. Si detectas vicio formal o sustantivo, indícalo explícito con la causal de nulidad aplicable.`;
}

function parsearSintesis(
  markdown: string,
  meta: { docs: number; detectados: ReturnType<typeof detectFields> }
): SintesisEstructurada {
  const block = markdown.match(/CASO:[\s\S]*?(?:RECOMENDACI[ÓO]N:.*?)(?:\n\n|\n$|$)/i);
  const fields: SintesisEstructurada = {
    documentosAnalizados: meta.docs,
    fechasISO: meta.detectados.fechasISO,
    rfcsDetectados: meta.detectados.rfc ? [meta.detectados.rfc] : [],
    expedientesDetectados: meta.detectados.expediente ? [meta.detectados.expediente] : [],
    fundamentosClave: meta.detectados.articulosCitados.slice(0, 20),
    adeudoTotal: meta.detectados.montoTotal,
  };

  if (block) {
    const txt = block[0];
    fields.caso = extractLine(txt, /CASO:\s*([^\n]+)/i);
    fields.estadoProcesal = extractLine(txt, /ESTADO PROCESAL:\s*([^\n]+)/i);
    fields.actoImpugnado = extractLine(txt, /ACTO IMPUGNADO:\s*([^\n]+)/i);
    fields.defensaVigente = extractLine(txt, /DEFENSA VIGENTE:\s*([^\n]+)/i);
    fields.riesgoPrincipal = extractLine(txt, /RIESGO PRINCIPAL:\s*([^\n]+)/i);
    fields.recomendacion = extractLine(txt, /RECOMENDACI[ÓO]N:\s*([^\n]+)/i);

    const montoLine = extractLine(txt, /ADEUDO TOTAL:\s*([^\n]+)/i);
    if (montoLine) {
      const num = montoLine.replace(/[^\d.]/g, "");
      const parsed = parseFloat(num);
      if (!Number.isNaN(parsed) && parsed > 0) fields.adeudoTotal = parsed;
    }

    const plazoLine = extractLine(txt, /PR[ÓO]XIMO PLAZO:\s*([^\n]+)/i);
    if (plazoLine) {
      const fechaMatch = plazoLine.match(/(\d{4}-\d{2}-\d{2})|(\d{1,2}\/\d{1,2}\/\d{4})/);
      if (fechaMatch) {
        const fecha = fechaMatch[1] ?? normalizarFecha(fechaMatch[2]);
        fields.proximoPlazo = { fecha, accion: plazoLine };
      } else {
        fields.proximoPlazo = { fecha: "", accion: plazoLine };
      }
    }
  }

  return fields;
}

function extractLine(text: string, re: RegExp): string | undefined {
  const m = text.match(re);
  return m?.[1]?.trim();
}

function normalizarFecha(dmy: string): string {
  const [d, m, y] = dmy.split("/");
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}
