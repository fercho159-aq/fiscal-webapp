import { signIn } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Scale } from "lucide-react";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const params = await searchParams;
  const callbackUrl = params.callbackUrl ?? "/dashboard";
  const error = params.error;

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Scale className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Acceso al sistema fiscal</CardTitle>
          <CardDescription>Ingresa con email y contraseña</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive">
              {error === "CredentialsSignin"
                ? "Email o contraseña incorrectos."
                : `Error: ${error}`}
            </div>
          )}

          {/* Form 1: email + password (admin hardcoded) */}
          <form
            action={async (formData) => {
              "use server";
              const email = (formData.get("email") as string)?.trim();
              const password = formData.get("password") as string;
              try {
                await signIn("credentials", {
                  email,
                  password,
                  redirectTo: callbackUrl,
                });
              } catch (err) {
                if (err instanceof Error && err.message.includes("NEXT_REDIRECT")) throw err;
                redirect(`/login?error=CredentialsSignin&callbackUrl=${encodeURIComponent(callbackUrl)}`);
              }
            }}
            className="space-y-3"
          >
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium">Email</label>
              <Input id="email" name="email" type="email" required autoComplete="email" placeholder="tu@correo.com" />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium">Contraseña</label>
              <Input id="password" name="password" type="password" required autoComplete="current-password" />
            </div>
            <Button type="submit" className="w-full">Iniciar sesión</Button>
          </form>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
            <div className="relative flex justify-center text-xs"><span className="bg-card px-2 text-muted-foreground">o</span></div>
          </div>

          {/* Form 2: magic link */}
          <form
            action={async (formData) => {
              "use server";
              await signIn("resend", {
                email: (formData.get("magicEmail") as string)?.trim(),
                redirectTo: callbackUrl,
              });
            }}
            className="space-y-3"
          >
            <div className="space-y-1.5">
              <label htmlFor="magicEmail" className="text-sm font-medium">Enlace mágico al correo</label>
              <Input id="magicEmail" name="magicEmail" type="email" required placeholder="tu@correo.com" />
            </div>
            <Button type="submit" variant="outline" className="w-full">Enviar enlace</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
