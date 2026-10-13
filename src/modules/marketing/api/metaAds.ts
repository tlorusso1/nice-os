/**
 * Meta Ads Marketing API
 *
 * Para ativar dados reais:
 *   1. Gere um token em business.facebook.com → Configurações → Tokens de acesso do sistema
 *   2. Adicione no .env.local:
 *      META_ADS_TOKEN=EAAxxxxxxx
 *      VITE_META_AD_ACCOUNT_ID=act_123456789
 *   3. Configure proxy em vite.config.ts:
 *      "/api/meta" → "https://graph.facebook.com"
 *      header: Authorization: Bearer <token>
 */

import { parseInsights } from "../lib/parseMetaInsights";
import { metric } from "../lib/dataQuality";
import { apiBase, proxyFetch } from "@/lib/apiBase";
const AD_ACCOUNT = import.meta.env.VITE_META_AD_ACCOUNT_ID ?? "";
const BASE = `${apiBase("meta")}/v20.0`;

export interface MetaInsights {
  spend: number | null;
  impressions: number | null;
  clicks: number | null;
  reach: number | null;
  ctr: number | null;
  cpc: number | null;
  cpp: number | null;
  purchases: number | null;
  purchaseValue: number | null;
  roas: number | null;
}

export interface MetaCampaign {
  id: string;
  name: string;
  status: "ACTIVE" | "PAUSED" | "ARCHIVED";
  objective: string;
  dailyBudget: number | null;
  insights: MetaInsights;
}

interface RawMetaEntity {
  id: string;
  name: string;
  status: MetaCampaign["status"];
  objective?: string;
  daily_budget?: string;
  targeting?: MetaAdSetTargeting;
  insights?: { data?: Record<string, unknown>[] };
  creative?: {
    thumbnail_url?: string;
    name?: string;
    object_story_spec?: { link_data?: { name?: string; message?: string; picture?: string } };
  };
}

// ── Funções públicas ────────────────────────────────────────────
export function isMetaConfigured(): boolean {
  return Boolean(AD_ACCOUNT && import.meta.env.VITE_META_ADS_CONFIGURED === "true");
}

export async function getMetaAccountInsights(datePreset = "this_month"): Promise<MetaInsights> {
  if (!isMetaConfigured()) throw new Error("metaAds: integração não configurada.");

  const fields = "spend,impressions,clicks,reach,ctr,cpc,cpp,actions,action_values";
  // Token injetado pelo proxy (vite.config.ts) — não exposto no browser
  const res = await proxyFetch(`${BASE}/${AD_ACCOUNT}/insights?fields=${fields}&date_preset=${datePreset}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Meta Ads insights: ${res.status} — ${err?.error?.message ?? ""}`);
  }
  const data = await res.json();
  if (!data.data?.[0]) throw new Error("Meta Ads: sem métricas retornadas para este período.");
  const insights = parseInsights(data.data[0]);
  if (Object.values(insights).every((value) => value === null)) throw new Error("Meta Ads: métricas indisponíveis na resposta.");
  return insights;
}

// ── Ad Sets (Públicos) ──────────────────────────────────────────
export interface MetaAdSetTargeting {
  age_min?: number;
  age_max?: number;
  genders?: number[]; // 1=M, 2=F
  geo_locations?: { countries?: string[]; cities?: { name: string }[] };
}

export interface MetaAdSet {
  id: string;
  name: string;
  status: "ACTIVE" | "PAUSED" | "ARCHIVED";
  dailyBudget: number | null;
  targeting: MetaAdSetTargeting;
  insights: MetaInsights;
}

// ── Ads (Criativos) ────────────────────────────────────────────
export interface MetaAd {
  id: string;
  name: string;
  status: "ACTIVE" | "PAUSED" | "ARCHIVED";
  thumbnailUrl: string;
  creative: { title?: string; body?: string; imageUrl?: string };
  insights: MetaInsights;
}

export async function getMetaAdSets(): Promise<MetaAdSet[]> {
  if (!isMetaConfigured()) throw new Error("metaAds: integração não configurada.");
  const fields = "id,name,status,daily_budget,targeting,insights.date_preset(this_month){spend,impressions,clicks,reach,ctr,cpc,cpp,actions,action_values}";
  const res = await proxyFetch(`${BASE}/${AD_ACCOUNT}/adsets?fields=${fields}&date_preset=this_month&limit=30`);
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(`Meta adsets: ${res.status} — ${err?.error?.message ?? ""}`); }
  const data = await res.json();
  if (!Array.isArray(data.data)) throw new Error("Meta Ads: formato de lista não reconhecido.");
  return data.data.map((raw: RawMetaEntity): MetaAdSet => ({
    id: raw.id, name: raw.name, status: raw.status,
    dailyBudget: metric(raw.daily_budget) === null ? null : metric(raw.daily_budget)! / 100,
    targeting: raw.targeting ?? {},
    insights: parseInsights(raw.insights?.data?.[0] ?? {}),
  }));
}

export async function getMetaAds(): Promise<MetaAd[]> {
  if (!isMetaConfigured()) throw new Error("metaAds: integração não configurada.");
  const fields = "id,name,status,creative{id,name,thumbnail_url,object_story_spec},insights.date_preset(this_month){spend,impressions,clicks,reach,ctr,cpc,cpp,actions,action_values}";
  const res = await proxyFetch(`${BASE}/${AD_ACCOUNT}/ads?fields=${fields}&date_preset=this_month&limit=50`);
  if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(`Meta ads: ${res.status} — ${err?.error?.message ?? ""}`); }
  const data = await res.json();
  if (!Array.isArray(data.data)) throw new Error("Meta Ads: formato de lista não reconhecido.");
  return data.data.map((raw: RawMetaEntity): MetaAd => ({
    id: raw.id, name: raw.name, status: raw.status,
    thumbnailUrl: raw.creative?.thumbnail_url ?? "",
    creative: {
      title: raw.creative?.object_story_spec?.link_data?.name ?? raw.creative?.name ?? "",
      body: raw.creative?.object_story_spec?.link_data?.message ?? "",
      imageUrl: raw.creative?.object_story_spec?.link_data?.picture ?? "",
    },
    insights: parseInsights(raw.insights?.data?.[0] ?? {}),
  }));
}

export async function uploadMetaImage(file: File): Promise<{ hash: string; url: string }> {
  if (!isMetaConfigured()) throw new Error("Meta Ads: integração não configurada.");
  const form = new FormData();
  form.append("filename", file.name);
  form.append("bytes", file);
  const res = await proxyFetch(`${BASE}/${AD_ACCOUNT}/adimages`, { method: "POST", body: form });
  if (!res.ok) throw new Error(`Meta upload: ${res.status}`);
  const data = await res.json();
  const imgData = Object.values(data.images ?? {})[0] as { hash?: string; url?: string } | undefined;
  if (!imgData?.hash) throw new Error("Meta Ads: upload sem confirmação da fonte.");
  return { hash: imgData.hash, url: imgData.url ?? "" };
}

export interface MetaCampaignUpdate {
  status?: "ACTIVE" | "PAUSED";
  dailyBudget?: number; // em reais — convertemos pra centavos
}

export async function updateMetaCampaign(id: string, updates: MetaCampaignUpdate): Promise<void> {
  if (!isMetaConfigured()) throw new Error("Meta Ads: integração não configurada.");
  const body: Record<string, unknown> = {};
  if (updates.status) body.status = updates.status;
  if (updates.dailyBudget != null) body.daily_budget = Math.round(updates.dailyBudget * 100); // centavos

  const res = await proxyFetch(`${BASE}/${id}`, {
    method: "POST", // Meta Graph API usa POST com ?method=PATCH ou POST direto pra updates
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(
      Object.entries(body).reduce((acc, [k, v]) => ({ ...acc, [k]: String(v) }), {})
    ).toString(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Meta update campaign: ${res.status} — ${err?.error?.message ?? ""}`);
  }
  const result = await res.json();
  if (result.success !== true) throw new Error("Meta Ads: alteração sem confirmação da fonte.");
}

export async function getMetaCampaigns(): Promise<MetaCampaign[]> {
  if (!isMetaConfigured()) throw new Error("metaAds: integração não configurada.");

  const fields = "id,name,status,objective,daily_budget,insights.date_preset(this_month){spend,impressions,clicks,reach,ctr,cpc,cpp,actions,action_values}";
  const res = await proxyFetch(`${BASE}/${AD_ACCOUNT}/campaigns?fields=${fields}&date_preset=this_month&limit=20`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Meta campaigns: ${res.status} — ${err?.error?.message ?? ""}`);
  }
  const data = await res.json();
  if (!Array.isArray(data.data)) throw new Error("Meta Ads: formato de lista não reconhecido.");
  return data.data.map(parseCampaign);
}

function parseCampaign(raw: RawMetaEntity): MetaCampaign {
  return {
    id: raw.id,
    name: raw.name,
    status: raw.status,
    objective: raw.objective ?? "",
    dailyBudget: metric(raw.daily_budget) === null ? null : metric(raw.daily_budget)! / 100,
    insights: parseInsights(raw.insights?.data?.[0] ?? {}),
  };
}
