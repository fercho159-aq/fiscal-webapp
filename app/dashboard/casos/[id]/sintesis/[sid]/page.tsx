import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SintesisRender } from "@/components/sintesis-render";
import { ArrowLeft, Download, AlertTriangle, Clock } from "lucide-react";
import { formatMoney, formatDateMX, diasHabilesEntre } from "@/lib/utils";

interface SintesisEstructurada {
  caso?: string;
  estadoProcesal?: string;
  adeudoTotal?: number;
  actoImpugnado?: string;
  defensaVigente?: string;
  proximoPlazo?: { fecha: string; accion: string };
  riesgoPrincipal?: string;
  recomendacion?: string;
  fundamentosClave?: string[];
  documentosAnalizados?: number;
  fechasISO?: string[];
}

export default async function SintesisPage({
  params,
}: {
  params: Promise<{ id: string; sid: string }>;
}) {
  const { id, sid } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const sintesis = await prisma.sintesis.findFirst({
    where: { id: sid, caso: { id, userId: session.user.id } },
    include: { caso: { select: { id: true, titulo: true } } },
  });
  if (!sintesis) notFound();

  const data = (sintesis.datosEstructurados ?? {}) as SintesisEstructurada;
  const now = new Date();
  const fechaPlazo = data.proximoPlazo?.fecha ? new Date(data.proximoPlazo.fecha) : null;
  const diasParaPlazo = fechaPlazo && fechaPlazo > now ? diasHabilesEntre(now, fechaPlazo) : null;
  const urgente = diasParaPlazo !== null && diasParaPlazo <= 10;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <Button variant="ghost" size="sm" asChild className="mb-4">
        <Link href={`/dashboard/casos/${sintesis.caso.id}`}>
          <ArrowLeft className="h-4 w-4" />
          {sintesis.caso.titulo}
        </Link>
      </Button>

      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            {sintesis.tipo.replace(/_/g, " ")}
          </div>
          <h1 className="text-2xl font-semibold mt-1">Síntesis</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Generada {formatDateMX(sintesis.generadaEn)} · {sintesis.modelo}
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <a href={`/api/sintesis/${sintesis.id}/export`} download>
            <Download className="h-4 w-4" />
            Export .docx
          </a>
        </Button>
      </div>

      {urgente && fechaPlazo && (
        <Card className="border-destructive bg-destructive/5 mb-4">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <div className="font-medium text-destructive">
                Plazo urgente: {formatDateMX(fechaPlazo)} ({diasParaPlazo}d hábiles)
              </div>
              {data.proximoPlazo?.accion && (
                <div className="text-sm mt-1">{data.proximoPlazo.accion}</div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 md:grid-cols-2 mb-6">
        <Stat label="Adeudo total" value={data.adeudoTotal ? formatMoney(data.adeudoTotal) : "—"} />
        <Stat
          label="Próximo plazo"
          value={fechaPlazo ? `${formatDateMX(fechaPlazo)}${diasParaPlazo !== null ? ` (${diasParaPlazo}d)` : ""}` : "—"}
          urgent={urgente}
        />
        <Stat label="Estado procesal" value={data.estadoProcesal ?? "—"} />
        <Stat label="Docs analizados" value={String(data.documentosAnalizados ?? "—")} />
      </div>

      {(data.actoImpugnado || data.defensaVigente || data.riesgoPrincipal || data.recomendacion) && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Resumen ejecutivo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {data.actoImpugnado && <KV label="Acto impugnado" value={data.actoImpugnado} />}
            {data.defensaVigente && <KV label="Defensa vigente" value={data.defensaVigente} />}
            {data.riesgoPrincipal && <KV label="Riesgo principal" value={data.riesgoPrincipal} variant="destructive" />}
            {data.recomendacion && <KV label="Recomendación" value={data.recomendacion} variant="primary" />}
          </CardContent>
        </Card>
      )}

      {data.fundamentosClave && data.fundamentosClave.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Fundamentos clave detectados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {data.fundamentosClave.map((f) => (
                <span
                  key={f}
                  className="text-xs px-2 py-1 rounded-md bg-secondary text-secondary-foreground font-mono"
                >
                  Art. {f}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Análisis completo</CardTitle>
        </CardHeader>
        <CardContent>
          <SintesisRender markdown={sintesis.contenidoMarkdown} />
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, urgent }: { label: string; value: string; urgent?: boolean }) {
  return (
    <Card className={urgent ? "border-destructive/50" : ""}>
      <CardContent className="p-4">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          {urgent && <Clock className="h-3 w-3 text-destructive" />}
          {label}
        </div>
        <div className={`text-base font-semibold mt-1 ${urgent ? "text-destructive" : ""}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function KV({
  label,
  value,
  variant = "default",
}: {
  label: string;
  value: string;
  variant?: "default" | "primary" | "destructive";
}) {
  const colors = {
    default: "",
    primary: "text-primary font-medium",
    destructive: "text-destructive font-medium",
  };
  return (
    <div className="flex flex-col sm:flex-row sm:gap-2 border-b last:border-0 pb-2 last:pb-0">
      <span className="text-xs uppercase tracking-wide text-muted-foreground sm:w-40 shrink-0">{label}</span>
      <span className={`flex-1 ${colors[variant]}`}>{value}</span>
    </div>
  );
}
