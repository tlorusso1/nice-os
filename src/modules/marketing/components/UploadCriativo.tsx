import { useState, useRef } from "react";
import { Upload, ImageIcon, CheckCircle2, XCircle, Loader2, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUploadMetaImage } from "../hooks/useMarketingData";
import { Button } from "@/components/ui/button";

type UploadState = "idle" | "preview" | "uploading" | "success" | "error";

export function UploadCriativo() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [state, setState] = useState<UploadState>("idle");
  const [result, setResult] = useState<{ hash: string; url: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { mutateAsync: upload } = useUploadMetaImage();

  function handleFile(f: File) {
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setState("preview");
    setResult(null);
    setErrorMsg("");
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f && (f.type.startsWith("image/") || f.type.startsWith("video/"))) {
      handleFile(f);
    }
  }

  async function handleUpload() {
    if (!file) return;
    setState("uploading");
    try {
      const res = await upload(file);
      setResult(res);
      setState("success");
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Erro ao enviar imagem");
      setState("error");
    }
  }

  function handleReset() {
    setFile(null);
    setPreviewUrl(null);
    setState("idle");
    setResult(null);
    setErrorMsg("");
    if (inputRef.current) inputRef.current.value = "";
  }

  const isImage = file?.type.startsWith("image/");

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Faça upload de imagens ou vídeos para usar em anúncios do Meta Ads.
        Formatos aceitos: JPG, PNG, GIF, MP4, MOV.
      </p>

      {/* Drop zone */}
      {(state === "idle" || state === "preview") && (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className={cn(
            "border-2 border-dashed rounded-xl transition-colors",
            state === "preview" ? "border-primary/40" : "border-border hover:border-primary/30",
          )}
        >
          {state === "idle" ? (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="w-full flex flex-col items-center gap-3 py-10 px-4 text-center"
            >
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <Upload size={22} className="text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">Arraste um arquivo aqui</p>
                <p className="text-xs text-muted-foreground mt-0.5">ou clique para selecionar</p>
              </div>
              <span className="text-[10px] text-muted-foreground">JPG, PNG, GIF, MP4, MOV · máx. 30 MB</span>
            </button>
          ) : (
            <div className="p-4 space-y-3">
              {/* Preview */}
              <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                {isImage && previewUrl ? (
                  <img src={previewUrl} alt="preview" className="w-full h-full object-contain" />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <ImageIcon size={32} />
                    <span className="text-xs">{file?.name}</span>
                  </div>
                )}
              </div>

              {/* File info */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <ImageIcon size={12} />
                <span className="truncate font-medium text-foreground">{file?.name}</span>
                <span className="shrink-0">· {((file?.size ?? 0) / 1024 / 1024).toFixed(1)} MB</span>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={handleReset}
                >
                  Trocar arquivo
                </Button>
                <Button
                  size="sm"
                  className="flex-1 gap-1.5"
                  onClick={handleUpload}
                >
                  <Upload size={13} />
                  Enviar para Meta
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Uploading state */}
      {state === "uploading" && (
        <div className="border rounded-xl p-6 flex flex-col items-center gap-3">
          <Loader2 size={28} className="animate-spin text-primary" />
          <div className="text-center">
            <p className="text-sm font-medium">Enviando para Meta Ads...</p>
            <p className="text-xs text-muted-foreground mt-0.5">{file?.name}</p>
          </div>
          {/* Indeterminate progress bar */}
          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full animate-[progress_1.5s_ease-in-out_infinite]" style={{ width: "60%" }} />
          </div>
        </div>
      )}

      {/* Success state */}
      {state === "success" && result && (
        <div className="border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div>
              <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">Upload concluído!</p>
              <p className="text-xs text-emerald-700 dark:text-emerald-400">Imagem disponível no Meta Ads</p>
            </div>
          </div>

          {result.url && (
            <a
              href={result.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              <ExternalLink size={11} />
              Ver imagem no Meta
            </a>
          )}

          <div className="bg-muted/50 rounded-lg p-2.5">
            <p className="text-[10px] text-muted-foreground mb-0.5">Hash do asset</p>
            <p className="text-xs font-mono break-all">{result.hash}</p>
          </div>

          <Button variant="outline" size="sm" onClick={handleReset} className="w-full">
            Enviar outro arquivo
          </Button>
        </div>
      )}

      {/* Error state */}
      {state === "error" && (
        <div className="border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <XCircle size={18} className="text-red-600 dark:text-red-400 shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-800 dark:text-red-300">Erro no upload</p>
              <p className="text-xs text-red-700 dark:text-red-400">{errorMsg}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleReset} className="w-full">
            Tentar novamente
          </Button>
        </div>
      )}

      {/* Hidden input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
    </div>
  );
}
