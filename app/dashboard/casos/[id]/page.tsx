import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Upload, MessageSquare, FileText, Sparkles } from "lucide-react";
import { formatMoney, formatDateMX } from "@/lib/utils";

export default async function CasoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const caso = await prisma.caso.findFirst({
    where: { id, userId: session.user.id },
    include: {
      documentos: { orderBy: { createdAt: "desc" } },
      sintesis: { orderBy: { generadaEn: "desc" }, take: 1 },
      _count: { select: { mensajes: true } },
    },
  });
  if (!caso) notFound();

  const sintesisReciente = caso.sintesis[0];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <Button variant="ghost" size="sm" asChild className="mb-4">
        <Link href="/dashboard">
          <ArrowLeft className="h-4 w-4" />
          Casos
        </Link>
      </Button>

      <div className="mb-6">
        <h1 className="text-2xl font-semibold">{caso.titulo}</h1>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground mt-2">
          {caso.expedienteNumero && <span>Exp: {caso.expedienteNumero}</span>}
          {caso.rfcContribuyente && <span>RFC: {caso.rfcContribuyente}</span>}
          {caso.razonSocial && <span>{caso.razonSocial}</span>}
          {caso.autoridadEmisora && <span>{caso.autoridadEmisora}</span>}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Stat label="Adeudo total" value={caso.montoTotal ? formatMoney(caso.montoTotal.toString()) : "—"} />
        <Stat label="Próximo plazo" value={caso.plazoProximo ? formatDateMX(caso.plazoProximo) : "—"} />
        <Stat label="Estado" value={caso.estadoProcesal ?? "Sin definir"} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">Documentos ({caso.documentos.length})</CardTitle>
            <Button size="sm" asChild>
              <Link href={`/dashboard/casos/${caso.id}/upload`}>
                <Upload className="h-4 w-4" />
                Subir
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {caso.documentos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aún no hay documentos. Sube oficios, acuerdos, resoluciones.</p>
            ) : (
              <ul className="space-y-2">
                {caso.documentos.map((doc) => (
                  <li key={doc.id} className="flex items-center gap-2 text-sm border-b pb-2 last:border-0">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="flex-1 truncate">{doc.nombre}</span>
                    <span className="text-xs text-muted-foreground">{doc.tipoDocumento}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">Análisis</CardTitle>
            <Button size="sm" asChild>
              <Link href={`/dashboard/casos/${caso.id}/analizar`}>
                <Sparkles className="h-4 w-4" />
                Generar síntesis
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {sintesisReciente ? (
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">
                  {sintesisReciente.tipo} · {formatDateMX(sintesisReciente.generadaEn)} · {sintesisReciente.modelo}
                </div>
                <div className="text-sm line-clamp-6 whitespace-pre-wrap">
                  {sintesisReciente.contenidoMarkdown}
                </div>
                <Button size="sm" variant="link" asChild className="px-0">
                  <Link href={`/dashboard/casos/${caso.id}/sintesis/${sintesisReciente.id}`}>Ver completa →</Link>
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Sin síntesis aún. Sube documentos y genera el análisis.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Button asChild variant="outline">
        <Link href={`/dashboard/casos/${caso.id}/chat`}>
          <MessageSquare className="h-4 w-4" />
          Chat sobre este caso ({caso._count.mensajes})
        </Link>
      </Button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-lg font-semibold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}
