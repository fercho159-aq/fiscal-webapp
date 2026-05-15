"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  endpoint: string;
  itemName: string;
  redirectTo?: string;
  size?: "sm" | "default" | "icon";
  variant?: "ghost" | "outline";
  className?: string;
  label?: string;
}

export function ConfirmDeleteButton({
  endpoint,
  itemName,
  redirectTo,
  size = "icon",
  variant = "ghost",
  className,
  label,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(endpoint, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `error ${res.status}`);
      }
      setOpen(false);
      if (redirectTo) {
        router.push(redirectTo);
      } else {
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "error");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant={variant}
        size={size}
        className={cn(
          "text-muted-foreground hover:text-destructive hover:bg-destructive/10",
          className
        )}
        onClick={() => setOpen(true)}
        title={`Eliminar ${itemName}`}
      >
        <Trash2 className={size === "icon" ? "h-4 w-4" : "h-3.5 w-3.5"} />
        {label && <span>{label}</span>}
      </Button>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm animate-fade-in"
        onClick={() => !loading && setOpen(false)}
      />
      {/* Modal */}
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 animate-scale-in">
        <div className="rounded-xl border bg-card shadow-lg">
          <div className="flex items-start gap-3 p-5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <Trash2 className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-semibold mb-1">Eliminar {itemName}</h3>
              <p className="text-sm text-muted-foreground">
                Esta acción no se puede deshacer. El archivo y todos los datos asociados se eliminarán permanentemente.
              </p>
              {error && (
                <p className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {error}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => !loading && setOpen(false)}
              className="text-muted-foreground hover:text-foreground"
              disabled={loading}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex justify-end gap-2 border-t bg-secondary/30 px-5 py-3 rounded-b-xl">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Eliminando...
                </>
              ) : (
                <>
                  <Trash2 className="h-3.5 w-3.5" />
                  Eliminar
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
