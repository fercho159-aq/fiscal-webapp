import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UploadDropzone } from "@/components/upload-dropzone";
import { ArrowLeft } from "lucide-react";

export default async function UploadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const caso = await prisma.caso.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true, titulo: true },
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

      <Card>
        <CardHeader>
          <CardTitle>Subir documentos</CardTitle>
        </CardHeader>
        <CardContent>
          <UploadDropzone casoId={caso.id} />
        </CardContent>
      </Card>
    </div>
  );
}
