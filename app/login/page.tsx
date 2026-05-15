import { signIn } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Scale } from "lucide-react";

export const dynamic = "force-dynamic";

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Scale className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Acceso al sistema fiscal</CardTitle>
          <CardDescription>Te enviaremos un enlace de acceso por correo</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            action={async (formData) => {
              "use server";
              const params = await searchParams;
              await signIn("resend", {
                email: formData.get("email") as string,
                redirectTo: params.callbackUrl ?? "/dashboard",
              });
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Correo electrónico
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="tu@despacho.com"
              />
            </div>
            <Button type="submit" className="w-full">
              Enviar enlace de acceso
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
