import { CorpusSearch } from "@/components/corpus-search";

export default function CorpusPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-xl font-semibold mb-1">Corpus legal fiscal</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Búsqueda semántica sobre 46 instrumentos normativos: códigos, leyes, RMF 2026, jurisprudencia SCJN/TFJA, criterios PRODECON, tratados.
      </p>
      <CorpusSearch />
    </div>
  );
}
