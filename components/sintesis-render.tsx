"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Renderiza markdown de síntesis con tipografía Montserrat consistente.
 * Encapsulado en un contenedor con estilos fijos para evitar variaciones CSS.
 */
export function SintesisRender({ markdown }: { markdown: string }) {
  return (
    <article className="fiscal-doc">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-2xl font-bold mt-6 mb-3 pb-2 border-b border-border tracking-tight">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-xl font-semibold mt-5 mb-2 tracking-tight">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base font-semibold mt-4 mb-2 uppercase tracking-wider text-muted-foreground">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-sm font-semibold mt-3 mb-1">{children}</h4>
          ),
          p: ({ children }) => (
            <p className="text-sm leading-relaxed mb-3 text-foreground">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc pl-6 mb-3 space-y-1 text-sm">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-6 mb-3 space-y-1 text-sm">{children}</ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">{children}</strong>
          ),
          em: ({ children }) => <em className="italic">{children}</em>,
          code: ({ children, className }) => {
            const isInline = !className;
            if (isInline) {
              return (
                <code className="px-1 py-0.5 rounded bg-muted text-xs font-mono">{children}</code>
              );
            }
            return (
              <code className="block p-3 rounded bg-muted text-xs font-mono overflow-x-auto whitespace-pre">
                {children}
              </code>
            );
          },
          pre: ({ children }) => <pre className="my-3">{children}</pre>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-primary/40 bg-muted/30 pl-4 py-2 my-3 italic text-sm">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-6 border-border" />,
          table: ({ children }) => (
            <div className="overflow-x-auto my-4">
              <table className="w-full text-sm border-collapse border border-border">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-muted/60">{children}</thead>,
          tbody: ({ children }) => <tbody>{children}</tbody>,
          tr: ({ children }) => <tr className="border-b border-border">{children}</tr>,
          th: ({ children }) => (
            <th className="px-3 py-2 text-left font-semibold border border-border">{children}</th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 border border-border align-top">{children}</td>
          ),
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-primary underline underline-offset-2 hover:no-underline"
            >
              {children}
            </a>
          ),
        }}
      >
        {markdown}
      </ReactMarkdown>
    </article>
  );
}
