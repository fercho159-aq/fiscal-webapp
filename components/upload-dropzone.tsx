"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

type FileStatus = "pending" | "uploading" | "done" | "error";

interface FileEntry {
  file: File;
  status: FileStatus;
  message?: string;
  tipoDocumento: string;
}

const TIPOS = [
  { value: "OFICIO_SAT", label: "Oficio SAT" },
  { value: "RESOLUCION_TFJA", label: "Resolución TFJA" },
  { value: "ACUERDO_SUSPENSION", label: "Acuerdo suspensión" },
  { value: "DEMANDA_NULIDAD", label: "Demanda nulidad" },
  { value: "AMPARO", label: "Amparo" },
  { value: "CONTESTACION", label: "Contestación" },
  { value: "REQUERIMIENTO", label: "Requerimiento" },
  { value: "NOTIFICACION", label: "Notificación" },
  { value: "ACTO_ADMINISTRATIVO", label: "Acto administrativo" },
  { value: "OTRO", label: "Otro" },
];

export function UploadDropzone({ casoId }: { casoId: string }) {
  const router = useRouter();
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [uploading, setUploading] = useState(false);

  const onDrop = useCallback((accepted: File[]) => {
    setFiles((prev) => [
      ...prev,
      ...accepted.map((file) => ({
        file,
        status: "pending" as FileStatus,
        tipoDocumento: detectTipo(file.name),
      })),
    ]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxSize: 20 * 1024 * 1024,
  });

  function setTipo(idx: number, tipo: string) {
    setFiles((prev) => prev.map((f, i) => (i === idx ? { ...f, tipoDocumento: tipo } : f)));
  }

  async function uploadAll() {
    setUploading(true);
    for (let i = 0; i < files.length; i++) {
      if (files[i].status !== "pending") continue;
      setFiles((prev) => prev.map((f, idx) => (idx === i ? { ...f, status: "uploading" } : f)));

      try {
        await uploadOne(casoId, files[i]);
        setFiles((prev) => prev.map((f, idx) => (idx === i ? { ...f, status: "done" } : f)));
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error";
        setFiles((prev) =>
          prev.map((f, idx) => (idx === i ? { ...f, status: "error", message: msg } : f))
        );
      }
    }
    setUploading(false);
    router.refresh();
  }

  const todoListo = files.length > 0 && files.every((f) => f.status === "done");

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
          isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
        }`}
      >
        <input {...getInputProps()} />
        <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
        <p className="text-sm font-medium">
          {isDragActive ? "Suelta aquí" : "Arrastra PDFs aquí, o click para seleccionar"}
        </p>
        <p className="text-xs text-muted-foreground mt-1">Max 20MB por archivo · PDF únicamente</p>
      </div>

      {files.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y">
              {files.map((entry, i) => (
                <li key={i} className="flex items-center gap-3 p-3">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{entry.file.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {(entry.file.size / 1024 / 1024).toFixed(2)} MB
                    </div>
                  </div>
                  <select
                    value={entry.tipoDocumento}
                    onChange={(e) => setTipo(i, e.target.value)}
                    disabled={entry.status !== "pending"}
                    className="text-xs border rounded px-2 py-1 bg-background"
                  >
                    {TIPOS.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <div className="w-6 flex justify-center">
                    {entry.status === "uploading" && <Loader2 className="h-4 w-4 animate-spin" />}
                    {entry.status === "done" && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                    {entry.status === "error" && (
                      <span title={entry.message}>
                        <AlertCircle className="h-4 w-4 text-destructive" />
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end gap-2">
        {files.length > 0 && !todoListo && (
          <Button onClick={uploadAll} disabled={uploading}>
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Subir {files.filter((f) => f.status === "pending").length} archivo(s)
          </Button>
        )}
        {todoListo && (
          <Button onClick={() => router.push(`/dashboard/casos/${casoId}`)}>Listo, volver al caso</Button>
        )}
      </div>
    </div>
  );
}

function detectTipo(filename: string): string {
  const f = filename.toLowerCase();
  if (/oficio.*sat|sat.*oficio/.test(f)) return "OFICIO_SAT";
  if (/tfja|resoluci[oó]n/.test(f)) return "RESOLUCION_TFJA";
  if (/suspen/.test(f)) return "ACUERDO_SUSPENSION";
  if (/demanda|nulidad/.test(f)) return "DEMANDA_NULIDAD";
  if (/amparo/.test(f)) return "AMPARO";
  if (/contesta/.test(f)) return "CONTESTACION";
  if (/requeri/.test(f)) return "REQUERIMIENTO";
  if (/notific/.test(f)) return "NOTIFICACION";
  if (/acto.*adm|adm.*acto/.test(f)) return "ACTO_ADMINISTRATIVO";
  return "OTRO";
}

async function uploadOne(casoId: string, entry: FileEntry): Promise<void> {
  // Upload directo vía server (evita mixed content con MinIO interno)
  const form = new FormData();
  form.append("file", entry.file);
  form.append("casoId", casoId);
  form.append("tipoDocumento", entry.tipoDocumento);

  const res = await fetch("/api/upload/direct", {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `error ${res.status}`);
  }
}
