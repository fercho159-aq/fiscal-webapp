import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getLLM, type LLMTier } from "@/lib/llm";
import { FISCAL_SYSTEM_PROMPT } from "@/lib/llm/system-prompt";
import { retrieveContext, inferFilters } from "@/lib/rag";
import { z } from "zod";

const Schema = z.object({
  casoId: z.string().optional(),
  message: z.string().min(1).max(8000),
  tier: z.enum(["default", "deep", "fast"]).default("default"),
  useRag: z.boolean().default(true),
});

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return new Response("unauthorized", { status: 401 });

  const body = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return new Response("invalid", { status: 400 });
  const { casoId, message, tier, useRag } = parsed.data;

  // Verificar caso si proviene
  let casoContext = "";
  let history: Array<{ rol: "USER" | "ASSISTANT"; contenido: string }> = [];

  if (casoId) {
    const caso = await prisma.caso.findFirst({
      where: { id: casoId, userId },
      include: {
        documentos: { select: { nombre: true, tipoDocumento: true, textoExtraido: true } },
        mensajes: { orderBy: { createdAt: "asc" }, take: 20 },
        sintesis: { orderBy: { generadaEn: "desc" }, take: 1 },
      },
    });
    if (!caso) return new Response("caso_not_found", { status: 404 });

    history = caso.mensajes
      .filter((m) => m.rol === "USER" || m.rol === "ASSISTANT")
      .map((m) => ({ rol: m.rol as "USER" | "ASSISTANT", contenido: m.contenido }));

    const docsTexto = caso.documentos
      .filter((d) => d.textoExtraido)
      .map((d) => `--- ${d.tipoDocumento} · ${d.nombre} ---\n${(d.textoExtraido ?? "").slice(0, 4000)}`)
      .join("\n\n");

    const sint = caso.sintesis[0]?.contenidoMarkdown ?? "";

    casoContext = `# CONTEXTO DEL CASO

- **Título:** ${caso.titulo}
- **Expediente:** ${caso.expedienteNumero ?? "—"}
- **RFC:** ${caso.rfcContribuyente ?? "—"}
- **Razón social:** ${caso.razonSocial ?? "—"}
- **Autoridad:** ${caso.autoridadEmisora ?? "—"}

${sint ? `## Última síntesis\n\n${sint.slice(0, 3000)}\n\n` : ""}
${docsTexto ? `## Documentos del expediente\n\n${docsTexto}\n\n` : ""}`;
  }

  // RAG opcional
  let ragContext = "";
  if (useRag && message.length > 20) {
    try {
      const filters = casoContext ? inferFilters(casoContext) : {};
      const rag = await retrieveContext(message, { topK: 5, filters });
      if (rag.hits.length > 0) {
        ragContext = `# REFERENCIAS DEL CORPUS LEGAL\n\n${rag.contextoMarkdown}\n\n`;
      }
    } catch (e) {
      console.error("RAG failed", e);
    }
  }

  const llm = getLLM(tier);

  // Guardar mensaje del usuario antes de generar
  if (casoId) {
    await prisma.mensaje.create({
      data: {
        casoId,
        userId,
        rol: "USER",
        contenido: message,
      },
    });
  }

  // Stream response
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let fullText = "";
      let inputTokens = 0;
      let outputTokens = 0;

      try {
        if (!llm.stream) throw new Error("provider no soporta streaming");

        const messages = [
          ...history.map((m) => ({
            role: m.rol === "USER" ? ("user" as const) : ("assistant" as const),
            content: m.contenido,
          })),
          { role: "user" as const, content: message },
        ];

        const userPrefix =
          (casoContext ? casoContext + "\n\n" : "") +
          (ragContext ? ragContext + "\n\n" : "") +
          (casoContext || ragContext ? "# PREGUNTA DEL USUARIO\n\n" : "");

        if (userPrefix) {
          messages[messages.length - 1] = {
            role: "user",
            content: userPrefix + message,
          };
        }

        for await (const chunk of llm.stream({
          systemPrompt: FISCAL_SYSTEM_PROMPT,
          messages,
          maxTokens: 4096,
          temperature: 0.2,
        })) {
          if (chunk.delta) {
            fullText += chunk.delta;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: chunk.delta })}\n\n`));
          }
          if (chunk.done && chunk.usage) {
            inputTokens = chunk.usage.inputTokens;
            outputTokens = chunk.usage.outputTokens;
          }
        }

        // Persistir respuesta
        if (casoId && fullText) {
          await prisma.mensaje.create({
            data: {
              casoId,
              userId,
              rol: "ASSISTANT",
              contenido: fullText,
              modelo: llm.defaultModel,
              tokensIn: inputTokens,
              tokensOut: outputTokens,
            },
          });
        }

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "error";
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

export const maxDuration = 300;
