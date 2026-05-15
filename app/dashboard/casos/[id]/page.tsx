import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import {
  ArrowLeft,
  Upload,
  MessageSquare,
  FileText,
  Sparkles,
  AlertTriangle,
  Eye,
} from "lucide-react";
import { formatMoney, formatDateMX, diasHabilesEntre } from "@/lib/utils";
import { stripMarkdown, stripMarkdownShort } from "@/lib/strip-markdown";

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

const TIPO_SINTESIS_LABEL: Record<string, string> = {
  EJECUTIVA: "Ejecutiva",
  PROFUNDA: "Profunda",
  ESTRATEGIA_DEFENSA: "Estrategia defensa",
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export default async function CasoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const caso = await prisma.caso.findFirst({
    where: { id, userId: session.user.id },
    include: {
      documentos: { orderBy: { createdAt: "desc" } },
      sintesis: { orderBy: { generadaEn: "desc" } },
      _count: { select: { mensajes: true } },
    },
  });
  if (!caso) notFound();

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
        <Stat
          label="Estado procesal"
          value={caso.estadoProcesal ? stripMarkdown(caso.estadoProcesal) : "Sin definir"}
        />
      </div>

      {/* DOCUMENTOS */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-eyebrow mb-0.5">Documentos del expediente</p>
            <h2 className="text-xl font-semibold tracking-tight">
              {caso.documentos.length} archivo{caso.documentos.length !== 1 ? "s" : ""}
            </h2>
          </div>
          <Button size="sm" asChild>
            <Link href={`/dashboard/casos/${caso.id}/upload`}>
              <Upload className="h-4 w-4" />
              Subir documento
            </Link>
          </Button>
        </div>

        {caso.documentos.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-sm text-muted-foreground">
                Sin documentos. Sube oficios, acuerdos, resoluciones para analizar.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <ul className="divide-y divide-border">
              {caso.documentos.map((doc) => (
                <li
                  key={doc.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/40 transition-colors"
                >
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate" title={doc.nombre}>
                      {doc.nombre}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                      <Badge variant="muted" size="sm">
                        {TIPO_LABEL[doc.tipoDocumento] ?? doc.tipoDocumento}
                      </Badge>
                      <span>·</span>
                      <span>{formatBytes(doc.tamanoBytes)}</span>
                      <span>·</span>
                      <span>{formatDateMX(doc.createdAt)}</span>
                      {doc.ocrAplicado && (
                        <>
                          <span>·</span>
                          <Badge variant="muted" size="sm">OCR</Badge>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      asChild
                      title="Ver documento"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <a href={`/api/documents/${doc.id}`} target="_blank" rel="noreferrer">
                        <Eye className="h-4 w-4" />
                      </a>
                    </Button>
                    <ConfirmDeleteButton
                      endpoint={`/api/documents/${doc.id}`}
                      itemName="documento"
                    />
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      {/* SÍNTESIS */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-eyebrow mb-0.5">Análisis generados</p>
            <h2 className="text-xl font-semibold tracking-tight">
              {caso.sintesis.length} síntesis
            </h2>
          </div>
          <Button size="sm" asChild>
            <Link href={`/dashboard/casos/${caso.id}/analizar`}>
              <Sparkles className="h-4 w-4" />
              Generar análisis
            </Link>
          </Button>
        </div>

        {caso.sintesis.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-sm text-muted-foreground">
                Sin síntesis. Sube documentos y genera el primer análisis.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {caso.sintesis.map((s) => (
              <Card
                key={s.id}
                className="transition-shadow hover:shadow-md"
              >
                <CardContent className="p-4 flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge variant="gold" size="sm">
                        {TIPO_SINTESIS_LABEL[s.tipo] ?? s.tipo}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDateMX(s.generadaEn)}
                      </span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs font-mono text-muted-foreground">
                        {s.modelo}
                      </span>
                    </div>
                    <p className="text-sm line-clamp-2 text-foreground/80 leading-relaxed">
                      {stripMarkdownShort(s.contenidoMarkdown, 220)}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <Button variant="ghost" size="sm" asChild className="text-xs">
                      <Link href={`/dashboard/casos/${caso.id}/sintesis/${s.id}`}>
                        <Eye className="h-3.5 w-3.5" />
                        Ver
                      </Link>
                    </Button>
                    <ConfirmDeleteButton
                      endpoint={`/api/sintesis/${s.id}`}
                      itemName="síntesis"
                      size="sm"
                      label="Eliminar"
                      className="text-xs justify-start"
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

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
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  mono = false,
  danger = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  danger?: boolean;
}) {
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
