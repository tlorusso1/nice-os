/**
 * Bulk Upload — orquestrador de fila de upload para o Meta Ads.
 * Cada item é processado com concorrência configurável (padrão 3).
 * O progresso é reportado via XMLHttpRequest.upload.onprogress.
 */


export interface UploadQueueItem {
  id: string;
  file: File;
  previewUrl: string;
  status: "pending" | "uploading" | "success" | "error";
  progress: number; // 0–100
  result?: { hash: string; url: string };
  error?: string;
  adSetId?: string; // associação opcional (UI only na fase 1)
}

export type UploadQueue = UploadQueueItem[];

export type QueueAction =
  | { type: "ADD_FILES"; files: File[] }
  | { type: "REMOVE_ITEM"; id: string }
  | { type: "SET_ADSET"; id: string; adSetId: string }
  | { type: "UPDATE_ITEM"; id: string; update: Partial<UploadQueueItem> }
  | { type: "CLEAR_COMPLETED" }
  | { type: "RESET" };

export function queueReducer(state: UploadQueue, action: QueueAction): UploadQueue {
  switch (action.type) {
    case "ADD_FILES":
      return [
        ...state,
        ...action.files.map((file) => ({
          id: crypto.randomUUID(),
          file,
          previewUrl: URL.createObjectURL(file),
          status: "pending" as const,
          progress: 0,
        })),
      ];
    case "REMOVE_ITEM":
      return state.filter((item) => item.id !== action.id);
    case "SET_ADSET":
      return state.map((item) =>
        item.id === action.id ? { ...item, adSetId: action.adSetId } : item
      );
    case "UPDATE_ITEM":
      return state.map((item) =>
        item.id === action.id ? { ...item, ...action.update } : item
      );
    case "CLEAR_COMPLETED":
      return state.filter((item) => item.status === "pending" || item.status === "uploading");
    case "RESET":
      return [];
    default:
      return state;
  }
}

// Faz upload de um único arquivo via XHR (permite progress events)
function uploadSingleFile(
  file: File,
  onProgress: (pct: number) => void
): Promise<{ hash: string; url: string }> {
  return new Promise((resolve, reject) => {
    const accountId = import.meta.env.VITE_META_AD_ACCOUNT_ID ?? "";

    if (!accountId || import.meta.env.VITE_META_ADS_CONFIGURED !== "true") {
      reject(new Error("Meta Ads: integração não configurada. Nenhum arquivo foi enviado."));
      return;
    }

    const xhr = new XMLHttpRequest();
    const form = new FormData();
    form.append("filename", file.name);
    form.append("bytes", file);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          const imgData = Object.values(data.images ?? {})[0] as Record<string, string>;
          if (!imgData?.hash) throw new Error("Upload sem confirmação da fonte");
          resolve({ hash: imgData.hash, url: imgData.url ?? "" });
        } catch {
          reject(new Error("Resposta inválida do Meta"));
        }
      } else {
        reject(new Error(`Meta upload: ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error("Erro de rede ao enviar para o Meta"));

    xhr.open("POST", `/api/meta/v20.0/${accountId}/adimages`);
    xhr.send(form);
  });
}

/**
 * Processa a fila de uploads com concorrência configurável.
 * Apenas items com status "pending" são processados.
 */
export async function processBulkUploadQueue(
  queue: UploadQueueItem[],
  onItemUpdate: (id: string, update: Partial<UploadQueueItem>) => void,
  concurrency = 3
): Promise<void> {
  const pending = queue.filter((item) => item.status === "pending");

  // Divide em chunks de tamanho `concurrency`
  for (let i = 0; i < pending.length; i += concurrency) {
    const chunk = pending.slice(i, i + concurrency);
    await Promise.allSettled(
      chunk.map((item) => {
        onItemUpdate(item.id, { status: "uploading", progress: 0 });
        return uploadSingleFile(item.file, (progress) => {
          onItemUpdate(item.id, { progress });
        })
          .then((result) => {
            onItemUpdate(item.id, { status: "success", progress: 100, result });
          })
          .catch((err: Error) => {
            onItemUpdate(item.id, { status: "error", progress: 0, error: err.message });
          });
      })
    );
  }
}
