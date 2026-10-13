/**
 * YouTube Data API v3 — dados públicos do canal NICE FOODS
 *
 * Para ativar dados reais (sem OAuth — apenas API key pública):
 *   1. Google Cloud Console → APIs & Services → YouTube Data API v3 → Criar API Key
 *   2. Adicione no .env.local:
 *      YOUTUBE_API_KEY=AIzaSy...       (server-side, injetado pelo proxy)
 *      VITE_YOUTUBE_CHANNEL_ID=UC...   (achar em YouTube Studio → Personalização)
 *      VITE_YOUTUBE_CONFIGURED=true
 */

import { metric } from "../lib/dataQuality";
import { apiBase, proxyFetch } from "@/lib/apiBase";
const BASE = apiBase("youtube");

// ── Interfaces ─────────────────────────────────────────────────

export interface YTChannelStats {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  subscriberCount: number | null;
  hiddenSubscriberCount: boolean;
  videoCount: number | null;
  viewCount: number | null;
  publishedAt: string;
}

export interface YTVideo {
  id: string;
  title: string;
  description: string;
  publishedAt: string;
  thumbnailUrl: string;
  duration: string; // ISO 8601, ex: "PT3M42S"
  durationSeconds: number | null;
  viewCount: number | null;
  likeCount: number | null;
  commentCount: number | null;
}

// ── Helpers ────────────────────────────────────────────────────

export function isYouTubeConfigured(): boolean {
  return Boolean(
    import.meta.env.VITE_YOUTUBE_CONFIGURED === "true" &&
    import.meta.env.VITE_YOUTUBE_CHANNEL_ID
  );
}

/** Converte ISO 8601 duration (PT3M42S) para segundos */
function parseDuration(iso: string): number | null {
  if (typeof iso !== "string") return null;
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return null;
  return (parseInt(m[1] ?? "0") * 3600) + (parseInt(m[2] ?? "0") * 60) + parseInt(m[3] ?? "0");
}

async function ytFetch<T>(path: string): Promise<T> {
  const res = await proxyFetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`YouTube API ${path}: ${res.status}`);
  return res.json();
}

// ── Public functions ───────────────────────────────────────────

export async function getYouTubeChannelStats(): Promise<YTChannelStats> {
  if (!isYouTubeConfigured()) throw new Error("youtube: integração não configurada.");

  const channelId = import.meta.env.VITE_YOUTUBE_CHANNEL_ID;
  const data = await ytFetch<{ items?: Record<string, unknown>[] }>(
    `/channels?part=statistics,snippet&id=${channelId}`
  );

  const item = data.items?.[0] as Record<string, Record<string, string | number | boolean>> | undefined;
  if (!item) throw new Error("YouTube: canal não encontrado na fonte.");

  const snippet    = item.snippet    as Record<string, string | Record<string, string>>;
  const statistics = item.statistics as Record<string, string | boolean>;

  return {
    id: channelId,
    title: String(snippet.title ?? ""),
    description: String(snippet.description ?? ""),
    thumbnailUrl: (snippet.thumbnails as unknown as Record<string, { url: string }>)?.high?.url ?? "",
    subscriberCount: metric(statistics.subscriberCount),
    hiddenSubscriberCount: statistics.hiddenSubscriberCount === true,
    videoCount: metric(statistics.videoCount),
    viewCount: metric(statistics.viewCount),
    publishedAt: String(snippet.publishedAt ?? ""),
  };
}

export async function getYouTubeVideos(): Promise<YTVideo[]> {
  if (!isYouTubeConfigured()) throw new Error("youtube: integração não configurada.");

  const channelId = import.meta.env.VITE_YOUTUBE_CHANNEL_ID;

  // Step 1: get recent video IDs via search
  const searchData = await ytFetch<{ items?: { id: { videoId: string } }[] }>(
    `/search?part=snippet&channelId=${channelId}&order=date&type=video&maxResults=10`
  );

  if (!Array.isArray(searchData.items)) throw new Error("YouTube: resposta de vídeos inválida.");
  const videoIds = (searchData.items ?? []).map((i) => i.id.videoId).join(",");
  if (!videoIds) return [];

  // Step 2: get full stats for those videos
  const videosData = await ytFetch<{
    items?: {
      id: string;
      snippet: { title: string; description: string; publishedAt: string; thumbnails: { high?: { url: string } } };
      statistics: { viewCount: string; likeCount: string; commentCount: string };
      contentDetails: { duration: string };
    }[];
  }>(`/videos?part=statistics,snippet,contentDetails&id=${videoIds}`);

  if (!Array.isArray(videosData.items)) throw new Error("YouTube: estatísticas de vídeos indisponíveis.");
  return videosData.items.map((v) => ({
    id: v.id,
    title: v.snippet.title,
    description: v.snippet.description,
    publishedAt: v.snippet.publishedAt,
    thumbnailUrl: v.snippet.thumbnails.high?.url ?? "",
    duration: v.contentDetails.duration,
    durationSeconds: parseDuration(v.contentDetails.duration),
    viewCount: metric(v.statistics.viewCount),
    likeCount: metric(v.statistics.likeCount),
    commentCount: metric(v.statistics.commentCount),
  }));
}
