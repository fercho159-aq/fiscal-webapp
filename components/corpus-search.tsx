"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Loader2, ExternalLink } from "lucide-react";

interface Hit {
  score: number;
  itemId: string;
  nombreOficial: string;
  abreviatura: string;
  tipo: string;
  label: string;
  text: string;
  urlOficial?: string;
  ultimaReforma?: string;
}

const FILTROS_LEY = ["CFF", "LISR", "LIVA", "LIEPS", "LA", "LFPCA", "LA-Amp", "LSS", "LINFONAVIT"];
const FILTROS_RMF = ["RMF", "A1A-RMF", "A3-RMF", "A7-RMF", "A20-RMF"];
const FILTROS_JURIS = ["JSCJN", "JTFJA", "TASCJN"];

export function CorpusSearch() {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const [filtro, setFiltro] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  function toggleFiltro(abrev: string) {
    setFiltro((prev) => (prev.includes(abrev) ? prev.filter((a) => a !== abrev) : [...prev, abrev]));
  }

  async function search(e?: React.FormEvent) {
    e?.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/corpus/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: query.trim(),
          topK: 10,
          abreviaturas: filtro.length ? filtro : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "error");
      setHits(data.hits ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "error");
      setHits([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={search} className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ej. plazo para juicio de nulidad · art. 156-Bis CFF · suspensión amparo fiscal"
          className="flex-1"
        />
        <Button type="submit" disabled={loading || !query.trim()}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Buscar
        </Button>
      </form>

      <div className="flex flex-wrap gap-2 text-xs">
        <span className="text-muted-foreground self-center">Filtrar:</span>
        {[...FILTROS_LEY, ...FILTROS_RMF, ...FILTROS_JURIS].map((a) => (
          <button
            key={a}
            onClick={() => toggleFiltro(a)}
            className={`px-2 py-1 rounded-md border transition-colors ${
              filtro.includes(a)
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background hover:bg-accent"
            }`}
          >
            {a}
          </button>
        ))}
        {filtro.length > 0 && (
          <button onClick={() => setFiltro([])} className="text-destructive ml-2">
            Limpiar
          </button>
        )}
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="p-3 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {hits.map((h, i) => (
          <Card key={`${h.itemId}-${i}`}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-sm font-mono text-primary">
                    {h.abreviatura} {h.label ? `— ${h.label}` : ""}
                  </CardTitle>
                  <div className="text-xs text-muted-foreground mt-1 truncate">{h.nombreOficial}</div>
                </div>
                <div className="text-xs text-muted-foreground shrink-0">{h.score.toFixed(3)}</div>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              <pre className="text-sm whitespace-pre-wrap font-sans line-clamp-6">{h.text}</pre>
              <div className="flex items-center gap-3 text-xs text-muted-foreground border-t pt-2">
                {h.tipo && <span>{h.tipo}</span>}
                {h.ultimaReforma && <span>Reforma: {h.ultimaReforma}</span>}
                {h.urlOficial && (
                  <a
                    href={h.urlOficial}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 ml-auto text-primary hover:underline"
                  >
                    Fuente <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </CardContent>
          </Card>
        ))}

        {!loading && hits.length === 0 && query && (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              Sin resultados. Prueba otros términos o desactiva los filtros.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
