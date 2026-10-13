/**
 * Instagram Business API — via Meta Graph API (mesmo token do Meta Ads)
 *
 * Para ativar dados reais:
 *   1. Certifique-se de ter META_ADS_TOKEN com scopes:
 *      instagram_basic, instagram_manage_insights, pages_show_list
 *   2. Adicione no .env.local:
 *      VITE_INSTAGRAM_CONFIGURED=true
 *   3. O ID da conta IG é resolvido automaticamente via Facebook Pages
 *      e cacheado em sessionStorage como "ig_account_id"
 */

import { metric, sumMetrics } from "../lib/dataQuality";
import { apiBase, proxyFetch } from "@/lib/apiBase";
const BASE = `${apiBase("meta")}/v20.0`;

// ── Interfaces ─────────────────────────────────────────────────

export interface IGProfile {
  id: string;
  username: string;
  followersCount: number | null;
  followsCount: number | null;
  mediaCount: number | null;
  profilePictureUrl: string;
  biography: string;
}

export interface IGMedia {
  id: string;
  caption: string;
  mediaType: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM" | "REEL";
  mediaUrl: string;
  thumbnailUrl?: string;
  permalink: string;
  timestamp: string;
  likeCount: number | null;
  commentsCount: number | null;
  insights?: {
    reach: number | null;
    impressions: number | null;
    saved: number | null;
    shares: number | null;
  };
}

export interface IGAccountInsights {
  reach: number | null;
  impressions: number | null;
  profileViews: number | null;
  followerCount: number | null;
}

// ── Helpers ────────────────────────────────────────────────────

export function isInstagramConfigured(): boolean {
  return import.meta.env.VITE_INSTAGRAM_CONFIGURED === "true";
}

async function resolveIGAccountId(): Promise<string | null> {
  // Cache in sessionStorage to avoid repeated lookups
  const cached = sessionStorage.getItem("ig_account_id");
  if (cached) return cached;

  try {
    const pagesRes = await proxyFetch(`${BASE}/me/accounts`);
    if (!pagesRes.ok) return null;
    const pagesData = await pagesRes.json();
    const pages: { id: string }[] = pagesData.data ?? [];
    if (pages.length === 0) return null;

    const pageRes = await proxyFetch(`${BASE}/${pages[0].id}?fields=instagram_business_account`);
    if (!pageRes.ok) return null;
    const pageData = await pageRes.json();
    const igId: string = pageData.instagram_business_account?.id ?? null;

    if (igId) {
      sessionStorage.setItem("ig_account_id", igId);
      return igId;
    }
  } catch {
    // Account resolution failed; callers must report unavailable, never fabricate data.
  }
  return null;
}

function parseInsights(insights: { data?: { name: string; values?: { value: number }[] }[] }): IGMedia["insights"] {
  const map: Record<string, number | null> = {};
  for (const metric of insights.data ?? []) {
    const val = metric.values?.[0]?.value;
    if (val !== undefined) map[metric.name] = val;
  }
  return {
    reach: metric(map.reach),
    impressions: metric(map.impressions),
    saved: metric(map.saved),
    shares: metric(map.shares),
  };
}

// ── Public functions ───────────────────────────────────────────

export async function getInstagramProfile(): Promise<IGProfile> {
  if (!isInstagramConfigured()) throw new Error("instagram: integração não configurada.");

  const igId = await resolveIGAccountId();
  if (!igId) throw new Error("Instagram: conta profissional não disponível.");

  const fields = "followers_count,follows_count,media_count,profile_picture_url,username,biography";
  const res = await proxyFetch(`${BASE}/${igId}?fields=${fields}`);
  if (!res.ok) throw new Error(`Instagram: falha na consulta (${res.status}).`);
  const d = await res.json();

  return {
    id: igId,
    username: d.username ?? "",
    followersCount: metric(d.followers_count),
    followsCount: metric(d.follows_count),
    mediaCount: metric(d.media_count),
    profilePictureUrl: d.profile_picture_url ?? "",
    biography: d.biography ?? "",
  };
}

export async function getInstagramMedia(): Promise<IGMedia[]> {
  if (!isInstagramConfigured()) throw new Error("instagram: integração não configurada.");

  const igId = await resolveIGAccountId();
  if (!igId) throw new Error("Instagram: conta profissional não disponível.");

  const fields = "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count";
  const res = await proxyFetch(`${BASE}/${igId}/media?fields=${fields}&limit=20`);
  if (!res.ok) throw new Error(`Instagram: falha na consulta (${res.status}).`);
  const data = await res.json();
  if (!Array.isArray(data.data)) throw new Error("Instagram: resposta de mídia inválida.");

  const items: IGMedia[] = await Promise.all(
    (data.data ?? []).map(async (raw: Record<string, string | number>) => {
      const item: IGMedia = {
        id: String(raw.id),
        caption: String(raw.caption ?? ""),
        mediaType: raw.media_type as IGMedia["mediaType"],
        mediaUrl: String(raw.media_url ?? ""),
        thumbnailUrl: raw.thumbnail_url ? String(raw.thumbnail_url) : undefined,
        permalink: String(raw.permalink ?? ""),
        timestamp: String(raw.timestamp ?? ""),
        likeCount: metric(raw.like_count),
        commentsCount: metric(raw.comments_count),
      };

      // Fetch insights for each media (only available for business accounts)
      try {
        const insightsRes = await proxyFetch(
          `${BASE}/${item.id}/insights?metric=reach,impressions,saved,shares`
        );
        if (insightsRes.ok) {
          const insightsData = await insightsRes.json();
          item.insights = parseInsights(insightsData) as IGMedia["insights"];
        }
      } catch {
        // insights not available for all media types
      }

      return item;
    })
  );

  return items;
}

export async function getInstagramAccountInsights(): Promise<IGAccountInsights> {
  if (!isInstagramConfigured()) throw new Error("instagram: integração não configurada.");

  const igId = await resolveIGAccountId();
  if (!igId) throw new Error("Instagram: conta profissional não disponível.");

  const since = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
  const until = Math.floor(Date.now() / 1000);
  const metrics = "reach,impressions,profile_views,follower_count";

  const res = await proxyFetch(
    `${BASE}/${igId}/insights?metric=${metrics}&period=day&since=${since}&until=${until}`
  );
  if (!res.ok) throw new Error(`Instagram: falha na consulta (${res.status}).`);

  const data = await res.json();
  const map: Record<string, number | null> = {};
  for (const metric of data.data ?? []) {
    const sum = sumMetrics((metric.values ?? []).map((v: { value: number }) => v.value));
    map[metric.name] = sum;
  }

  return {
    reach: metric(map.reach),
    impressions: metric(map.impressions),
    profileViews: metric(map.profile_views),
    followerCount: metric(map.follower_count),
  };
}
