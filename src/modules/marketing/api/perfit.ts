/**
 * Perfit Email Marketing API
 *
 * Para ativar dados reais:
 *   1. Perfit → Configurações → API → copiar API Key
 *   2. Adicione no .env.local:
 *      PERFIT_API_KEY=...
 *      PERFIT_ACCOUNT=nicefoods   (nome da conta/subdomínio)
 *      VITE_PERFIT_CONFIGURED=true
 */

import { requireMetric } from "../lib/dataQuality";
import { apiBase, proxyFetch } from "@/lib/apiBase";
const BASE = apiBase("perfit");

// ── Interfaces ─────────────────────────────────────────────────

export interface PerfitCampaignStats {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  unsubscribed: number;
  bounced: number;
  openRate: number;
  clickRate: number;
}

export interface PerfitCampaign {
  id: string;
  name: string;
  status: "sent" | "draft" | "scheduled" | "sending";
  sentAt?: string;
  subject: string;
  listName: string;
  stats?: PerfitCampaignStats;
}

export interface PerfitList {
  id: string;
  name: string;
  subscribersCount: number;
  activeCount: number;
}

export interface PerfitSummary {
  totalSent: number;
  avgOpenRate: number;
  avgClickRate: number;
  unsubscribeRate: number;
}

// ── Helpers ────────────────────────────────────────────────────

export function isPerfitConfigured(): boolean {
  return import.meta.env.VITE_PERFIT_CONFIGURED === "true";
}

async function perfitGet<T>(path: string): Promise<T> {
  const res = await proxyFetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`Perfit ${path}: ${res.status}`);
  return res.json();
}

// ── Public functions ───────────────────────────────────────────

export async function getPerfitCampaigns(): Promise<PerfitCampaign[]> {
  if (!isPerfitConfigured()) throw new Error("perfit: integração não configurada.");
  const campaigns = await perfitGet<PerfitCampaign[]>("/campaigns?status=all&limit=20");
  if (!Array.isArray(campaigns)) throw new Error("Perfit: formato de campanhas não reconhecido.");
  for (const campaign of campaigns) {
    if (campaign.stats) for (const key of ["sent", "delivered", "opened", "clicked", "unsubscribed", "bounced", "openRate", "clickRate"] as const) {
      campaign.stats[key] = requireMetric(campaign.stats[key]);
    }
  }
  return campaigns;
}

export async function getPerfitLists(): Promise<PerfitList[]> {
  if (!isPerfitConfigured()) throw new Error("perfit: integração não configurada.");
  return perfitGet<PerfitList[]>("/lists");
}

export async function getPerfitSummary(): Promise<PerfitSummary> {
  if (!isPerfitConfigured()) throw new Error("perfit: integração não configurada.");
  const summary = await perfitGet<PerfitSummary>("/reports/summary");
  return { totalSent: requireMetric(summary.totalSent), avgOpenRate: requireMetric(summary.avgOpenRate), avgClickRate: requireMetric(summary.avgClickRate), unsubscribeRate: requireMetric(summary.unsubscribeRate) };

}
