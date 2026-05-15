import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AnalizarButtons } from "@/components/analizar-button";
import { ArrowLeft, AlertTriangle } from "lucide-react";

export default async function AnalizarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const caso = await prisma.caso.findFirst({
    where: { id, userId: session.user.id },
    include: { documentos: { select: { id: true, nombre: true, tipoDocumento: true } } },
  });
  if (!caso) notFound();

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Button variant="ghost" size="sm" asChild className="mb-4">
        <Link href={`/dashboard/casos/${caso.id}`}>
          <ArrowLeft className="h-4 w-4" />
          {caso.titulo}
        </Link>
      </Button>

      <h1 className="text-2xl font-semibold mb-2">Generar análisis</h1>
      <p className="text-sm text-muted-foreground mb-6">
        El agente analizará los {caso.documentos.length} documento(s) del expediente cruzados con el corpus legal vectorizado.
      </p>

      {caso.documentos.length === 0 ? (
        <Card className="border-amber-500/50">
          <CardContent className="p-4 flex gap-3 items-start">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-medium mb-1">Caso sin documentos</div>
              <p className="text-sm text-muted-foreground mb-3">
                Necesitas subir al menos un oficio, resolución o acuerdo para generar la síntesis.
              </p>
              <Button asChild size="sm">
                <Link href={`/dashboard/casos/${caso.id}/upload`}>Subir documentos</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base">Documentos a analizar</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1 text-sm">
                {caso.documentos.map((d) => (
                  <li key={d.id} className="flex gap-2">
                    <span className="text-muted-foreground text-xs uppercase shrink-0">
                      {d.tipoDocumento.replace(/_/g, " ")}
                    </span>
                    <span className="truncate">{d.nombre}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <AnalizarButtons casoId={caso.id} />
        </>
      )}
    </div>
  );
}
