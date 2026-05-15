import { signIn } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      {/* Background sutil */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent/20 via-background to-background" />

      <div className="relative z-10 w-full max-w-md animate-slide-up">
        {/* Brand */}
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md">
            <Scale className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Fiscal</h1>
          <p className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">
            Análisis SAT · TFJA · Amparo
          </p>
        </div>

        <Card className="shadow-md">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Accede a tu cuenta</CardTitle>
            <CardDescription className="text-xs">
              Ingresa con email y contraseña, o pide enlace de acceso por correo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive animate-fade-in">
                {error === "CredentialsSignin"
                  ? "Email o contraseña incorrectos."
                  : `Error: ${error}`}
              </div>
            )}

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
                <label htmlFor="email" className="text-xs font-medium text-muted-foreground">
                  Email
                </label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="tu@correo.com"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="password" className="text-xs font-medium text-muted-foreground">
                  Contraseña
                </label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                />
              </div>
              <Button type="submit" className="w-full">
                Iniciar sesión
              </Button>
            </form>

            <Separator label="o" />

            <form
              action={async (formData) => {
                "use server";
                await signIn("resend", {
                  email: (formData.get("magicEmail") as string)?.trim(),
                  redirectTo: callbackUrl,
                });
              }}
              className="space-y-2"
            >
              <Input
                id="magicEmail"
                name="magicEmail"
                type="email"
                required
                placeholder="Enlace mágico al correo"
                className="text-sm"
              />
              <Button type="submit" variant="outline" className="w-full">
                Enviar enlace de acceso
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Sistema interno · Solo personal autorizado
        </p>
      </div>
    </div>
  );
}
