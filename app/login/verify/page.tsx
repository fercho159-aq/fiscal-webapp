import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail } from "lucide-react";

export default function VerifyPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Revisa tu correo</CardTitle>
          <CardDescription>
            Te enviamos un enlace de acceso. Es válido por 24 horas.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Si no lo recibes en unos minutos, revisa tu carpeta de spam.
        </CardContent>
      </Card>
    </div>
  );
}
