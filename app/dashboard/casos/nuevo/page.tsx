import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NuevoCasoPage() {
  async function crear(formData: FormData) {
    "use server";
    const session = await auth();
    if (!session?.user?.id) redirect("/login");

    const titulo = (formData.get("titulo") as string).trim();
    if (!titulo) return;

    const caso = await prisma.caso.create({
      data: {
        userId: session.user.id,
        titulo,
        expedienteNumero: (formData.get("expedienteNumero") as string) || null,
        rfcContribuyente: (formData.get("rfc") as string) || null,
        razonSocial: (formData.get("razonSocial") as string) || null,
        autoridadEmisora: (formData.get("autoridad") as string) || null,
      },
    });
    redirect(`/dashboard/casos/${caso.id}`);
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Button variant="ghost" size="sm" asChild className="mb-4">
        <Link href="/dashboard">
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Nuevo caso</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={crear} className="space-y-4">
            <Field name="titulo" label="Título del caso" required placeholder="Ej. Bomberos vs SAT — inmovilización" />
            <Field name="expedienteNumero" label="Expediente" placeholder="4380/24-06-04-1-OT" />
            <Field name="rfc" label="RFC contribuyente" placeholder="ABC123456XYZ" />
            <Field name="razonSocial" label="Razón social" placeholder="Súper Servicio Bomberos, S.A. de C.V." />
            <Field name="autoridad" label="Autoridad emisora" placeholder="SAT Adm. Desconcentrada Tamaulipas 3" />

            <div className="flex gap-2 justify-end pt-4">
              <Button variant="outline" asChild>
                <Link href="/dashboard">Cancelar</Link>
              </Button>
              <Button type="submit">Crear caso</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  name,
  label,
  required,
  placeholder,
}: {
  name: string;
  label: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="text-sm font-medium">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </label>
      <Input id={name} name={name} required={required} placeholder={placeholder} />
    </div>
  );
}
