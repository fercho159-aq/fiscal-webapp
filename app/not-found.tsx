import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="max-w-lg w-full text-center">
        <CardHeader>
          <FileQuestion className="h-12 w-12 mx-auto text-muted-foreground" />
          <CardTitle className="mt-2">No encontrado</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            La página o recurso que buscas no existe.
          </p>
          <Button asChild>
            <Link href="/dashboard">Ir al dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
