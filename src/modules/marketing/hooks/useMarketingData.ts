import { consolidateMarketing } from "../lib/consolidateMarketing";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { processBulkUploadQueue } from "../api/bulkUpload";
import type { UploadQueue, UploadQueueItem } from "../api/bulkUpload";
export type { UploadQueue, UploadQueueItem };
import {
  getMetaAccountInsights,
  getMetaCampaigns,
  getMetaAdSets,
  getMetaAds,
  uploadMetaImage,
  updateMetaCampaign,
  isMetaConfigured,
  type MetaInsights,
  type MetaCampaign,
  type MetaCampaignUpdate,
  type MetaAdSet,
  type MetaAd,
} from "../api/metaAds";
import {
  getGoogleAccountInsights,
  getGoogleCampaigns,
  isGoogleConfigured,
  type GoogleAccountInsights,
  type GoogleCampaign,
} from "../api/googleAds";
import {
  isInstagramConfigured,
  getInstagramProfile,
  getInstagramMedia,
  getInstagramAccountInsights,
  type IGProfile,
  type IGMedia,
  type IGAccountInsights,
} from "../api/instagram";
import {
  isYouTubeConfigured,
  getYouTubeChannelStats,
  getYouTubeVideos,
  type YTChannelStats,
  type YTVideo,
} from "../api/youtube";
import {
  isGA4Configured,
  getTrafficByChannel,
  getGA4Summary,
  type GA4ChannelBreakdown,
  type GA4Summary,
} from "../api/ga4";
import {
  isPerfitConfigured,
  getPerfitCampaigns,
  getPerfitLists,
  getPerfitSummary,
  type PerfitCampaign,
  type PerfitList,
  type PerfitSummary,
} from "../api/perfit";

export type {
  IGProfile, IGMedia, IGAccountInsights,
  YTChannelStats, YTVideo,
  GA4ChannelBreakdown, GA4Summary,
  PerfitCampaign, PerfitList, PerfitSummary,
};

export type { MetaInsights, MetaCampaign, MetaCampaignUpdate, MetaAdSet, MetaAd, GoogleAccountInsights, GoogleCampaign };

// ── Classificação de performance ────────────────────────────────
export type CampanhaClassificacao = "escalavel" | "monitorar" | "matar" | "pausada" | "sem_dados";

export function classificarCampanha(c: Pick<MetaCampaign, "status" | "insights">): CampanhaClassificacao {
  if (c.status === "PAUSED") return "pausada";
  if (c.status !== "ACTIVE") return "sem_dados";
  if (c.insights.spend === null || c.insights.roas === null || c.insights.spend === 0) return "sem_dados";
  if (c.insights.roas >= 3.5) return "escalavel";
  if (c.insights.roas >= 2) return "monitorar";
  if (c.insights.spend > 200) return "matar";
  return "sem_dados";
}

export const CLASSIFICACAO_CONFIG: Record<CampanhaClassificacao, { label: string; emoji: string; color: string }> = {
  escalavel: { label: "Escalável",  emoji: "🚀", color: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900" },
  monitorar: { label: "Monitorar",  emoji: "👀", color: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900" },
  matar:     { label: "Matar",      emoji: "🔴", color: "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900" },
  pausada:   { label: "Pausada",    emoji: "⏸",  color: "text-muted-foreground bg-muted border-border" },
  sem_dados: { label: "Poucos dados", emoji: "📊", color: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900" },
};

export interface ChannelSummary {
  channel: "meta" | "google" | "tiktok";
  label: string;
  color: string;
  spend: number | null;
  roas: number | null;
  configured: boolean;
  status: "available" | "loading" | "error" | "unconfigured" | "unimplemented";
  updatedAt: number;
}

export function useMetaAdSets() {
  return useQuery({ queryKey: ["marketing", "meta", "adsets"], queryFn: getMetaAdSets, enabled: isMetaConfigured(), staleTime: 1000 * 60 * 15, retry: 1 });
}

export function useMetaAds() {
  return useQuery({ queryKey: ["marketing", "meta", "ads"], queryFn: getMetaAds, enabled: isMetaConfigured(), staleTime: 1000 * 60 * 15, retry: 1 });
}

export function useUploadMetaImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadMetaImage(file),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["marketing", "meta", "ads"] }),
  });
}

// ── Instagram ────────────────────────────────────────────────
export function useInstagramProfile() {
  return useQuery({
    queryKey: ["marketing", "instagram", "profile"],
    enabled: isInstagramConfigured(),
    queryFn: getInstagramProfile,
    staleTime: 1000 * 60 * 30,
    retry: 1,
  });
}

export function useInstagramMedia() {
  return useQuery({
    queryKey: ["marketing", "instagram", "media"],
    enabled: isInstagramConfigured(),
    queryFn: getInstagramMedia,
    staleTime: 1000 * 60 * 15,
    retry: 1,
  });
}

export function useInstagramInsights() {
  return useQuery({
    queryKey: ["marketing", "instagram", "insights"],
    enabled: isInstagramConfigured(),
    queryFn: getInstagramAccountInsights,
    staleTime: 1000 * 60 * 15,
    retry: 1,
  });
}

// ── YouTube ──────────────────────────────────────────────────
export function useYouTubeStats() {
  return useQuery({
    queryKey: ["marketing", "youtube", "channel"],
    enabled: isYouTubeConfigured(),
    queryFn: getYouTubeChannelStats,
    staleTime: 1000 * 60 * 60,
    retry: 1,
  });
}

export function useYouTubeVideos() {
  return useQuery({
    queryKey: ["marketing", "youtube", "videos"],
    enabled: isYouTubeConfigured(),
    queryFn: getYouTubeVideos,
    staleTime: 1000 * 60 * 30,
    retry: 1,
  });
}

// ── GA4 Analytics ────────────────────────────────────────────
export function useGA4TrafficByChannel() {
  return useQuery({
    queryKey: ["marketing", "ga4", "traffic"],
    enabled: isGA4Configured(),
    queryFn: () => getTrafficByChannel(),
    staleTime: 1000 * 60 * 30,
    retry: 1,
  });
}

export function useGA4Summary() {
  return useQuery({
    queryKey: ["marketing", "ga4", "summary"],
    enabled: isGA4Configured(),
    queryFn: () => getGA4Summary(),
    staleTime: 1000 * 60 * 30,
    retry: 1,
  });
}

// ── Perfit Email ──────────────────────────────────────────────
export function usePerfitCampaigns() {
  return useQuery({
    queryKey: ["marketing", "perfit", "campaigns"],
    enabled: isPerfitConfigured(),
    queryFn: getPerfitCampaigns,
    staleTime: 1000 * 60 * 15,
    retry: 1,
  });
}

export function usePerfitLists() {
  return useQuery({
    queryKey: ["marketing", "perfit", "lists"],
    enabled: isPerfitConfigured(),
    queryFn: getPerfitLists,
    staleTime: 1000 * 60 * 30,
    retry: 1,
  });
}

export function usePerfitSummary() {
  return useQuery({
    queryKey: ["marketing", "perfit", "summary"],
    enabled: isPerfitConfigured(),
    queryFn: getPerfitSummary,
    staleTime: 1000 * 60 * 15,
    retry: 1,
  });
}

export function useBulkUploadQueue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ queue, onItemUpdate }: {
      queue: UploadQueue;
      onItemUpdate: (id: string, update: Partial<UploadQueueItem>) => void;
    }) => processBulkUploadQueue(queue, onItemUpdate, 3),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["marketing", "meta", "ads"] }),
  });
}

export function useUpdateMetaCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: MetaCampaignUpdate }) =>
      updateMetaCampaign(id, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["marketing", "meta", "campaigns"] });
    },
  });
}

export function useMetaInsights() {
  return useQuery({
    queryKey: ["marketing", "meta", "insights"],
    enabled: isMetaConfigured(),
    queryFn: () => getMetaAccountInsights("this_month"),
    staleTime: 1000 * 60 * 15,
    retry: 1,
  });
}

export function useMetaCampaigns() {
  return useQuery({
    queryKey: ["marketing", "meta", "campaigns"],
    enabled: isMetaConfigured(),
    queryFn: getMetaCampaigns,
    staleTime: 1000 * 60 * 15,
    retry: 1,
  });
}

export function useGoogleInsights() {
  return useQuery({
    queryKey: ["marketing", "google", "insights"],
    enabled: isGoogleConfigured(),
    queryFn: getGoogleAccountInsights,
    staleTime: 1000 * 60 * 15,
    retry: 1,
  });
}

export function useGoogleCampaigns() {
  return useQuery({
    queryKey: ["marketing", "google", "campaigns"],
    enabled: isGoogleConfigured(),
    queryFn: getGoogleCampaigns,
    staleTime: 1000 * 60 * 15,
    retry: 1,
  });
}

export function useMarketingConsolidado() {
  const meta = useMetaInsights();
  const google = useGoogleInsights();
  // A failed refresh must not silently reuse stale data as current.
  const metaData = isMetaConfigured() && !meta.isError ? meta.data : undefined;
  const googleData = isGoogleConfigured() && !google.isError ? google.data : undefined;
  const consolidated = consolidateMarketing(
    metaData ? { spend: metaData.spend, revenue: metaData.purchaseValue, clicks: metaData.clicks } : undefined,
    googleData ? { spend: googleData.spend, revenue: googleData.conversionValue, clicks: googleData.clicks } : undefined,
  );
  const channels: ChannelSummary[] = [
    {
      channel: "meta", label: "Meta Ads", color: "#1877F2",
      spend: metaData?.spend ?? null, roas: metaData?.roas ?? null,
      configured: isMetaConfigured(), updatedAt: meta.dataUpdatedAt,
      status: !isMetaConfigured() ? "unconfigured" : meta.isError ? "error" : meta.isLoading ? "loading" : metaData ? "available" : "error",
    },
    {
      channel: "google", label: "Google Ads", color: "#4285F4",
      spend: googleData?.spend ?? null, roas: googleData?.roas ?? null,
      configured: isGoogleConfigured(), updatedAt: google.dataUpdatedAt,
      status: "unimplemented",
    },
    {
      channel: "tiktok", label: "TikTok Ads", color: "#010101",
      spend: null, roas: null, configured: false, updatedAt: 0, status: "unimplemented",
    },
  ];
  return {
    ...consolidated, channels,
    isLoading: meta.isLoading || google.isLoading,
    isError: meta.isError || google.isError,
  };
}
