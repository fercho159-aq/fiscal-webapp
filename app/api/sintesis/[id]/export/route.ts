import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generarDocxSintesis } from "@/lib/export-docx";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const session = await auth();
  if (!session?.user?.id) return new Response("unauthorized", { status: 401 });

  const sintesis = await prisma.sintesis.findFirst({
    where: { id, caso: { userId: session.user.id } },
    include: { caso: true },
  });
  if (!sintesis) return new Response("not_found", { status: 404 });

  const data = (sintesis.datosEstructurados ?? {}) as Record<string, unknown>;

  const buf = await generarDocxSintesis({
    membreteLine1: process.env.MEMBRETE_LINE_1,
    membreteLine2: process.env.MEMBRETE_LINE_2,
    titulo: sintesis.caso.titulo,
    expediente: sintesis.caso.expedienteNumero ?? undefined,
    rfc: sintesis.caso.rfcContribuyente ?? undefined,
    razonSocial: sintesis.caso.razonSocial ?? undefined,
    autoridad: sintesis.caso.autoridadEmisora ?? undefined,
    fechaGeneracion: sintesis.generadaEn,
    modelo: sintesis.modelo,
    adeudoTotal: typeof data.adeudoTotal === "number" ? data.adeudoTotal : undefined,
    estadoProcesal: data.estadoProcesal as string | undefined,
    actoImpugnado: data.actoImpugnado as string | undefined,
    defensaVigente: data.defensaVigente as string | undefined,
    proximoPlazo:
      data.proximoPlazo && typeof data.proximoPlazo === "object"
        ? (data.proximoPlazo as { accion?: string }).accion
        : undefined,
    riesgoPrincipal: data.riesgoPrincipal as string | undefined,
    recomendacion: data.recomendacion as string | undefined,
    fundamentosClave: (data.fundamentosClave as string[]) ?? [],
    contenidoMarkdown: sintesis.contenidoMarkdown,
  });

  const filename = `sintesis-${sintesis.caso.titulo.replace(/[^\w]+/g, "-").slice(0, 50)}-${id.slice(0, 8)}.docx`;

  return new Response(buf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
