import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/empty-state";
import { ArrowLeft, Upload, MessageSquare, FileText, Sparkles, AlertTriangle, Clock } from "lucide-react";
import { formatMoney, formatDateMX, diasHabilesEntre } from "@/lib/utils";

const TIPO_LABEL: Record<string, string> = {
  OFICIO_SAT: "Oficio SAT",
  RESOLUCION_TFJA: "Resolución TFJA",
  ACUERDO_SUSPENSION: "Acuerdo suspensión",
  DEMANDA_NULIDAD: "Demanda nulidad",
  AMPARO: "Amparo",
  CONTESTACION: "Contestación",
  REQUERIMIENTO: "Requerimiento",
  NOTIFICACION: "Notificación",
  ACTO_ADMINISTRATIVO: "Acto administrativo",
  OTRO: "Otro",
};

export default async function CasoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const caso = await prisma.caso.findFirst({
    where: { id, userId: session.user.id },
    include: {
      documentos: { orderBy: { createdAt: "desc" } },
      sintesis: { orderBy: { generadaEn: "desc" }, take: 3 },
      _count: { select: { mensajes: true } },
    },
  });
  if (!caso) notFound();

  const sintesisReciente = caso.sintesis[0];
  const now = new Date();
  const diasParaPlazo =
    caso.plazoProximo && caso.plazoProximo > now ? diasHabilesEntre(now, caso.plazoProximo) : null;
  const plazoUrgente = diasParaPlazo !== null && diasParaPlazo <= 10;

  return (
    <div className="p-8 max-w-6xl mx-auto animate-fade-in">
      <Button variant="ghost" size="sm" asChild className="mb-6 -ml-2 text-muted-foreground">
        <Link href="/dashboard">
          <ArrowLeft className="h-4 w-4" />
          Todos los casos
        </Link>
      </Button>

      {/* Header */}
      <div className="mb-8">
        <p className="text-eyebrow mb-2">Expediente</p>
        <h1 className="text-3xl font-semibold tracking-tight mb-3">{caso.titulo}</h1>
        <div className="flex flex-wrap gap-1.5">
          {caso.expedienteNumero && (
            <Badge variant="outline" className="font-mono">
              {caso.expedienteNumero}
            </Badge>
          )}
          {caso.rfcContribuyente && (
            <Badge variant="muted" className="font-mono">
              RFC: {caso.rfcContribuyente}
            </Badge>
          )}
          {caso.razonSocial && <Badge variant="muted">{caso.razonSocial}</Badge>}
          {caso.autoridadEmisora && <Badge variant="muted">{caso.autoridadEmisora}</Badge>}
        </div>
      </div>

      {/* Plazo urgente prominente */}
      {plazoUrgente && caso.plazoProximo && (
        <Card className="mb-6 border-destructive/40 bg-destructive/5 animate-scale-in">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/15 text-destructive">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="text-eyebrow text-destructive mb-0.5">Plazo crítico</div>
              <div className="text-sm font-semibold text-destructive">
                {formatDateMX(caso.plazoProximo)} · {diasParaPlazo} días hábiles restantes
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats principales */}
      <div className="grid gap-3 md:grid-cols-3 mb-8">
        <Stat
          label="Adeudo total"
          value={caso.montoTotal ? formatMoney(caso.montoTotal.toString()) : "—"}
          mono
        />
        <Stat
          label="Próximo plazo"
          value={caso.plazoProximo ? formatDateMX(caso.plazoProximo) : "—"}
          danger={plazoUrgente}
        />
        <Stat label="Estado procesal" value={caso.estadoProcesal ?? "Sin definir"} />
      </div>

      {/* 2 columnas: docs + analisis */}
      <div className="grid gap-4 md:grid-cols-2 mb-8">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-eyebrow mb-0.5">Documentos</p>
                <h2 className="text-base font-semibold">{caso.documentos.length} archivos</h2>
              </div>
              <Button size="sm" asChild>
                <Link href={`/dashboard/casos/${caso.id}/upload`}>
                  <Upload className="h-4 w-4" />
                  Subir
                </Link>
              </Button>
            </div>
            {caso.documentos.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">
                Sin documentos. Sube oficios, acuerdos, resoluciones.
              </p>
            ) : (
              <ul className="space-y-2 -mx-2">
                {caso.documentos.slice(0, 5).map((doc) => (
                  <li
                    key={doc.id}
                    className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-secondary/50 transition-colors text-sm"
                  >
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="flex-1 truncate" title={doc.nombre}>
                      {doc.nombre}
                    </span>
                    <Badge variant="muted" size="sm">
                      {TIPO_LABEL[doc.tipoDocumento] ?? doc.tipoDocumento}
                    </Badge>
                  </li>
                ))}
                {caso.documentos.length > 5 && (
                  <li className="px-2 text-xs text-muted-foreground">
                    + {caso.documentos.length - 5} documentos más
                  </li>
                )}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-eyebrow mb-0.5">Análisis</p>
                <h2 className="text-base font-semibold">
                  {caso.sintesis.length} síntesis generadas
                </h2>
              </div>
              <Button size="sm" asChild>
                <Link href={`/dashboard/casos/${caso.id}/analizar`}>
                  <Sparkles className="h-4 w-4" />
                  Generar
                </Link>
              </Button>
            </div>
            {sintesisReciente ? (
              <div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                  <Badge variant="gold" size="sm">
                    {sintesisReciente.tipo.replace(/_/g, " ")}
                  </Badge>
                  <span>·</span>
                  <span>{formatDateMX(sintesisReciente.generadaEn)}</span>
                </div>
                <p className="text-sm line-clamp-4 text-foreground/80 leading-relaxed mb-3">
                  {sintesisReciente.contenidoMarkdown
                    .replace(/[#*`>]/g, "")
                    .slice(0, 240)}
                  …
                </p>
                <Button size="sm" variant="link" asChild className="px-0 h-auto">
                  <Link href={`/dashboard/casos/${caso.id}/sintesis/${sintesisReciente.id}`}>
                    Ver análisis completo →
                  </Link>
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4">
                Sin análisis. Sube documentos y genera la primera síntesis.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Separator label="Acciones" className="mb-4" />

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" asChild>
          <Link href={`/dashboard/casos/${caso.id}/chat`}>
            <MessageSquare className="h-4 w-4" />
            Chat sobre este caso
            {caso._count.mensajes > 0 && (
              <Badge variant="muted" size="sm" className="ml-1">
                {caso._count.mensajes}
              </Badge>
            )}
          </Link>
        </Button>
        {caso.sintesis.length > 1 && (
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/dashboard/casos/${caso.id}/analizar`}>
              Ver historial de análisis ({caso.sintesis.length})
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, mono = false, danger = false }: { label: string; value: string; mono?: boolean; danger?: boolean }) {
  return (
    <Card className={danger ? "border-destructive/30" : ""}>
      <CardContent className="p-4">
        <p className="text-eyebrow mb-1">{label}</p>
        <p
          className={`text-lg font-semibold leading-tight ${mono ? "tabular" : ""} ${
            danger ? "text-destructive" : ""
          }`}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
