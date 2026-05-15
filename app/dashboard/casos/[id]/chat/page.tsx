import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Chat } from "@/components/chat";
import { ArrowLeft } from "lucide-react";

export default async function CasoChat({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const caso = await prisma.caso.findFirst({
    where: { id, userId: session.user.id },
    include: { mensajes: { orderBy: { createdAt: "asc" } } },
  });
  if (!caso) notFound();

  const initial = caso.mensajes
    .filter((m) => m.rol !== "SYSTEM")
    .map((m) => ({
      rol: m.rol === "USER" ? ("user" as const) : ("assistant" as const),
      contenido: m.contenido,
    }));

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Button variant="ghost" size="sm" asChild className="mb-4">
        <Link href={`/dashboard/casos/${caso.id}`}>
          <ArrowLeft className="h-4 w-4" />
          {caso.titulo}
        </Link>
      </Button>

      <h1 className="text-xl font-semibold mb-4">Chat sobre el caso</h1>

      <Chat
        casoId={caso.id}
        initialMessages={initial}
        placeholder="Pregunta sobre fundamentos, plazos, vías de defensa, jurisprudencia aplicable…"
      />
    </div>
  );
}
