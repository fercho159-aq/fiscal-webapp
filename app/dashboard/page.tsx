import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { Plus, AlertTriangle, Clock, FolderOpen, FileText, Sparkles, TrendingUp } from "lucide-react";
import { formatMoney, formatDateMX, diasHabilesEntre } from "@/lib/utils";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const casos = await prisma.caso.findMany({
    where: { userId: session.user.id, archivado: false },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { documentos: true, sintesis: true } } },
  });

  const now = new Date();

  // Stats globales
  const totalAdeudo = casos.reduce((sum, c) => sum + Number(c.montoTotal ?? 0), 0);
  const plazosUrgentes = casos.filter(
    (c) => c.plazoProximo && c.plazoProximo > now && diasHabilesEntre(now, c.plazoProximo) <= 10
  );
  const docsTotal = casos.reduce((s, c) => s + c._count.documentos, 0);

  return (
    <div className="p-8 max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-end justify-between mb-8 gap-4">
        <div>
          <p className="text-eyebrow mb-1">Panel principal</p>
          <h1 className="text-3xl font-semibold tracking-tight">Casos activos</h1>
        </div>
        <Button asChild>
          <Link href="/dashboard/casos/nuevo">
            <Plus className="h-4 w-4" />
            Nuevo caso
          </Link>
        </Button>
      </div>

      {/* Stats globales */}
      <div className="grid gap-3 md:grid-cols-4 mb-8">
        <StatCard
          label="Casos activos"
          value={String(casos.length)}
          icon={<FolderOpen className="h-4 w-4" />}
        />
        <StatCard
          label="Adeudo total"
          value={totalAdeudo > 0 ? formatMoney(totalAdeudo) : "—"}
          icon={<TrendingUp className="h-4 w-4" />}
          mono
        />
        <StatCard
          label="Plazos urgentes"
          value={String(plazosUrgentes.length)}
          icon={<AlertTriangle className="h-4 w-4" />}
          variant={plazosUrgentes.length > 0 ? "destructive" : "default"}
        />
        <StatCard
          label="Documentos"
          value={String(docsTotal)}
          icon={<FileText className="h-4 w-4" />}
        />
      </div>

      {casos.length === 0 ? (
        <EmptyState
          icon={<FolderOpen className="h-6 w-6" />}
          title="Sin casos todavía"
          description="Crea tu primer expediente. Subes oficios SAT, resoluciones TFJA y el agente analiza fundamentos, plazos y vías de defensa."
          action={
            <Button asChild>
              <Link href="/dashboard/casos/nuevo">
                <Plus className="h-4 w-4" />
                Crear primer caso
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 animate-slide-up">
          {casos.map((caso) => {
            const diasParaPlazo =
              caso.plazoProximo && caso.plazoProximo > now
                ? diasHabilesEntre(now, caso.plazoProximo)
                : null;
            const plazoUrgente = diasParaPlazo !== null && diasParaPlazo <= 10;

            return (
              <Link key={caso.id} href={`/dashboard/casos/${caso.id}`} className="group">
                <Card
                  className={`h-full transition-all duration-200 hover:shadow-md group-hover:border-primary/30 ${
                    plazoUrgente ? "border-destructive/40" : ""
                  }`}
                >
                  <CardContent className="p-5">
                    {/* Title + badge */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <h3 className="text-sm font-semibold leading-snug line-clamp-2 flex-1">
                        {caso.titulo}
                      </h3>
                      {plazoUrgente && (
                        <Badge variant="destructive" size="sm">
                          <AlertTriangle className="h-2.5 w-2.5" />
                          Urgente
                        </Badge>
                      )}
                    </div>

                    {/* Razón social */}
                    {caso.razonSocial && (
                      <p className="text-xs text-muted-foreground line-clamp-1 mb-3">
                        {caso.razonSocial}
                      </p>
                    )}

                    {/* Expediente / RFC */}
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {caso.expedienteNumero && (
                        <Badge variant="outline" size="sm" className="font-mono">
                          {caso.expedienteNumero}
                        </Badge>
                      )}
                      {caso.rfcContribuyente && (
                        <Badge variant="muted" size="sm" className="font-mono">
                          {caso.rfcContribuyente}
                        </Badge>
                      )}
                    </div>

                    {/* Monto destacado */}
                    {caso.montoTotal && (
                      <div className="mb-3">
                        <div className="text-eyebrow">Adeudo</div>
                        <div className="text-lg font-semibold tabular text-foreground">
                          {formatMoney(caso.montoTotal.toString())}
                        </div>
                      </div>
                    )}

                    {/* Plazo */}
                    {caso.plazoProximo && (
                      <div
                        className={`flex items-center gap-1.5 text-xs mb-3 ${
                          plazoUrgente ? "text-destructive font-medium" : "text-muted-foreground"
                        }`}
                      >
                        {plazoUrgente ? (
                          <AlertTriangle className="h-3 w-3" />
                        ) : (
                          <Clock className="h-3 w-3" />
                        )}
                        <span>
                          Plazo: {formatDateMX(caso.plazoProximo)}
                          {diasParaPlazo !== null && ` · ${diasParaPlazo}d hábiles`}
                        </span>
                      </div>
                    )}

                    {/* Footer counts */}
                    <div className="flex items-center gap-3 pt-3 border-t border-border text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        {caso._count.documentos} docs
                      </span>
                      <span className="flex items-center gap-1">
                        <Sparkles className="h-3 w-3" />
                        {caso._count.sintesis} análisis
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  variant = "default",
  mono = false,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  variant?: "default" | "destructive";
  mono?: boolean;
}) {
  const isDanger = variant === "destructive" && value !== "0";
  return (
    <Card className={isDanger ? "border-destructive/30 bg-destructive/5" : ""}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className={isDanger ? "text-destructive" : "text-muted-foreground"}>{icon}</span>
          <span className="text-eyebrow">{label}</span>
        </div>
        <div className={`text-2xl font-semibold ${mono ? "tabular" : ""} ${isDanger ? "text-destructive" : ""}`}>
          {value}
        </div>
      </CardContent>
    </Card>
  );
}
