"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SintesisRender } from "@/components/sintesis-render";
import { Send, Loader2, User, Bot } from "lucide-react";

interface Message {
  rol: "user" | "assistant";
  contenido: string;
}

interface Props {
  casoId?: string;
  initialMessages?: Message[];
  placeholder?: string;
}

export function Chat({ casoId, initialMessages = [], placeholder }: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");
    setMessages((prev) => [...prev, { rol: "user", contenido: text }, { rol: "assistant", contenido: "" }]);
    setStreaming(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ casoId, message: text, useRag: true }),
      });
      if (!res.ok || !res.body) {
        throw new Error(`error ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6);
          try {
            const parsed = JSON.parse(payload);
            if (parsed.delta) {
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last.rol === "assistant") {
                  updated[updated.length - 1] = { ...last, contenido: last.contenido + parsed.delta };
                }
                return updated;
              });
            } else if (parsed.error) {
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  rol: "assistant",
                  contenido: `**Error:** ${parsed.error}`,
                };
                return updated;
              });
            }
          } catch {}
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "error";
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { rol: "assistant", contenido: `**Error:** ${msg}` };
        return updated;
      });
    } finally {
      setStreaming(false);
      inputRef.current?.focus();
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)] max-h-[800px]">
      <div className="flex-1 overflow-y-auto space-y-4 p-2">
        {messages.length === 0 && (
          <div className="text-center text-sm text-muted-foreground mt-12">
            {placeholder ?? "Pregunta sobre el caso, fundamentos, plazos…"}
          </div>
        )}

        {messages.map((m, i) => (
          <Card key={i} className={`p-4 ${m.rol === "user" ? "bg-muted/30" : ""}`}>
            <div className="flex gap-3">
              <div className="shrink-0 mt-0.5">
                {m.rol === "user" ? (
                  <User className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <Bot className="h-5 w-5 text-primary" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                {m.rol === "assistant" ? (
                  m.contenido ? (
                    <SintesisRender markdown={m.contenido} />
                  ) : streaming ? (
                    <span className="text-sm text-muted-foreground">...</span>
                  ) : null
                ) : (
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{m.contenido}</p>
                )}
              </div>
            </div>
          </Card>
        ))}

        <div ref={endRef} />
      </div>

      <div className="border-t pt-3 flex gap-2">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={streaming}
          rows={2}
          placeholder="Escribe tu pregunta… (Enter para enviar, Shift+Enter para salto)"
          className="flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
        />
        <Button onClick={send} disabled={streaming || !input.trim()}>
          {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
