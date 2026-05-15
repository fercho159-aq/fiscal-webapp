import { Chat } from "@/components/chat";

export default function ChatLibre() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-xl font-semibold mb-1">Chat libre</h1>
      <p className="text-sm text-muted-foreground mb-4">
        Consulta general — usa RAG sobre el corpus legal mexicano (CFF, RMF, LFPCA, jurisprudencia…).
      </p>
      <Chat placeholder="¿Qué dice el art. 156-Bis del CFF? · ¿Cómo se calcula el factor de actualización? · ¿Plazo para demanda de nulidad?" />
    </div>
  );
}
