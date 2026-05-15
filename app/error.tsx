"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="max-w-lg w-full">
        <CardHeader>
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-destructive" />
            <CardTitle>Algo salió mal</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Ocurrió un error al procesar tu solicitud. Si persiste, contacta soporte con el código abajo.
          </p>
          {error.digest && (
            <code className="text-xs bg-muted px-2 py-1 rounded block">{error.digest}</code>
          )}
          <div className="flex gap-2">
            <Button onClick={reset}>Reintentar</Button>
            <Button variant="outline" asChild>
              <a href="/dashboard">Ir al dashboard</a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
