import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, AlertTriangle, Clock } from "lucide-react";
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

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Casos activos</h1>
          <p className="text-sm text-muted-foreground">{casos.length} expedientes</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/casos/nuevo">
            <Plus className="h-4 w-4" />
            Nuevo caso
          </Link>
        </Button>
      </div>

      {casos.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground mb-4">Aún no tienes casos. Crea el primero.</p>
            <Button asChild>
              <Link href="/dashboard/casos/nuevo">
                <Plus className="h-4 w-4" />
                Crear caso
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {casos.map((caso) => {
            const diasParaPlazo =
              caso.plazoProximo && caso.plazoProximo > now
                ? diasHabilesEntre(now, caso.plazoProximo)
                : null;
            const plazoUrgente = diasParaPlazo !== null && diasParaPlazo <= 10;

            return (
              <Link key={caso.id} href={`/dashboard/casos/${caso.id}`}>
                <Card className="hover:shadow-md transition-shadow h-full">
                  <CardHeader>
                    <CardTitle className="text-base line-clamp-2">{caso.titulo}</CardTitle>
                    {caso.razonSocial && (
                      <CardDescription className="line-clamp-1">{caso.razonSocial}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {caso.expedienteNumero && (
                      <div className="text-muted-foreground">Exp: {caso.expedienteNumero}</div>
                    )}
                    {caso.montoTotal && (
                      <div className="font-medium">{formatMoney(caso.montoTotal.toString())}</div>
                    )}
                    {caso.plazoProximo && (
                      <div
                        className={`flex items-center gap-1 text-xs ${
                          plazoUrgente ? "text-destructive font-medium" : "text-muted-foreground"
                        }`}
                      >
                        {plazoUrgente ? (
                          <AlertTriangle className="h-3 w-3" />
                        ) : (
                          <Clock className="h-3 w-3" />
                        )}
                        {formatDateMX(caso.plazoProximo)}
                        {diasParaPlazo !== null && ` (${diasParaPlazo}d hábiles)`}
                      </div>
                    )}
                    <div className="flex gap-3 pt-2 text-xs text-muted-foreground border-t">
                      <span>{caso._count.documentos} docs</span>
                      <span>{caso._count.sintesis} síntesis</span>
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
