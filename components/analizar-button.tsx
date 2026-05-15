"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Sparkles, Zap, Brain } from "lucide-react";

type Tipo = "EJECUTIVA" | "PROFUNDA" | "ESTRATEGIA_DEFENSA";
type Tier = "default" | "deep" | "fast";

const OPCIONES: Array<{
  tipo: Tipo;
  tier: Tier;
  label: string;
  modelo: string;
  descripcion: string;
  icon: React.ReactNode;
  costEstimate: string;
}> = [
  {
    tipo: "EJECUTIVA",
    tier: "default",
    label: "Síntesis ejecutiva",
    modelo: "Sonnet 4.6",
    descripcion: "Identificación + cuantificación + plazos + síntesis en bloque. Lo más común.",
    icon: <Sparkles className="h-5 w-5" />,
    costEstimate: "~$0.05",
  },
  {
    tipo: "PROFUNDA",
    tier: "deep",
    label: "Análisis profundo",
    modelo: "Opus 4.7",
    descripcion: "Tabla completa créditos + timeline + vicios artículo por artículo + escenarios. Casos críticos.",
    icon: <Brain className="h-5 w-5" />,
    costEstimate: "~$0.40",
  },
  {
    tipo: "ESTRATEGIA_DEFENSA",
    tier: "deep",
    label: "Estrategia de defensa",
    modelo: "Opus 4.7",
    descripcion: "Vías procesales priorizadas + plazos + garantías + jurisprudencia + acciones próximas 72h.",
    icon: <Zap className="h-5 w-5" />,
    costEstimate: "~$0.40",
  },
];

export function AnalizarButtons({ casoId }: { casoId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<Tipo | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generar(tipo: Tipo, tier: Tier) {
    setLoading(tipo);
    setError(null);
    try {
      const res = await fetch("/api/sintesis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ casoId, tipo, tier }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "error desconocido");
      }
      const { sintesisId } = await res.json();
      router.push(`/dashboard/casos/${casoId}/sintesis/${sintesisId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "error desconocido");
      setLoading(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3">
        {OPCIONES.map((opt) => (
          <Card key={opt.tipo} className="hover:border-primary/50 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                <div className="mt-0.5 text-primary">{opt.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="font-medium">{opt.label}</div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {opt.modelo} · {opt.costEstimate}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">{opt.descripcion}</p>
                  <Button
                    size="sm"
                    onClick={() => generar(opt.tipo, opt.tier)}
                    disabled={loading !== null}
                  >
                    {loading === opt.tipo ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Generando...
                      </>
                    ) : (
                      <>
                        {opt.icon}
                        Generar
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="p-3 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}
    </div>
  );
}
