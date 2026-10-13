/**
 * Google Analytics 4 Data API v1beta
 *
 * Para ativar dados reais (via Service Account — sem OAuth no browser):
 *   1. Google Cloud Console → IAM → Criar Service Account
 *   2. Conceder "Viewer" na propriedade GA4
 *   3. Baixar JSON da chave → base64 -i sa-key.json
 *   4. Adicione no .env.local:
 *      GOOGLE_SA_KEY_JSON=<base64>
 *      VITE_GA4_PROPERTY_ID=properties/XXXXXXXXX
 *      VITE_GA4_CONFIGURED=true
 *   5. Token injetado automaticamente pelo proxy /api/ga4 (vite.config.ts — Semana 3)
 */

import { requireMetric } from "../lib/dataQuality";
import { apiBase, proxyFetch } from "@/lib/apiBase";
const BASE = `${apiBase("ga4")}/v1beta`;
const PROPERTY_ID = import.meta.env.VITE_GA4_PROPERTY_ID ?? "";

// ── Interfaces ─────────────────────────────────────────────────

export interface GA4ChannelBreakdown {
  channel: string;
  sessions: number;
  users: number;
  newUsers: number;
  bounceRate: number;
  conversions: number;
  revenue: number;
  color: string;
}

export interface GA4ReportRequest {
  dimensions: { name: string }[];
  metrics: { name: string }[];
  dateRanges: { startDate: string; endDate: string }[];
  limit?: number;
}

export interface GA4Summary {
  totalSessions: number;
  totalUsers: number;
  totalConversions: number;
  totalRevenue: number;
  organicShare: number | null;   // 0–100 %
  paidShare: number | null;      // 0–100 %
}

// ── Color map for channels ─────────────────────────────────────

const CHANNEL_COLORS: Record<string, string> = {
  "Organic Search":  "#10b981",
  "Paid Search":     "#3b82f6",
  "Organic Social":  "#a855f7",
  "Paid Social":     "#6366f1",
  "Direct":          "#6b7280",
  "Email":           "#f59e0b",
  "Referral":        "#ec4899",
  "Organic Video":   "#ef4444",
  "Cross-network":   "#8b5cf6",
};

function channelColor(channel: string): string {
  return CHANNEL_COLORS[channel] ?? "#64748b";
}

// ── Helpers ────────────────────────────────────────────────────

export function isGA4Configured(): boolean {
  return Boolean(import.meta.env.VITE_GA4_CONFIGURED === "true" && PROPERTY_ID);
}

async function runReport(request: GA4ReportRequest): Promise<{
  rows?: { dimensionValues: { value: string }[]; metricValues: { value: string }[] }[];
  rowCount?: number;
}> {
  const res = await proxyFetch(`${BASE}/${PROPERTY_ID}:runReport`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!res.ok) throw new Error(`GA4 runReport: ${res.status}`);
  return res.json();
}

// ── Public functions ───────────────────────────────────────────

export async function getTrafficByChannel(dateRange = { startDate: "29daysAgo", endDate: "today" }): Promise<GA4ChannelBreakdown[]> {
  if (!isGA4Configured()) throw new Error("ga4: integração não configurada.");

  const data = await runReport({
    dimensions:  [{ name: "sessionDefaultChannelGroup" }],
    metrics:     [
      { name: "sessions" }, { name: "totalUsers" }, { name: "newUsers" },
      { name: "bounceRate" }, { name: "conversions" }, { name: "purchaseRevenue" },
    ],
    dateRanges:  [dateRange],
    limit:       100,
  });

  if (data.rowCount && data.rowCount > (data.rows?.length ?? 0)) throw new Error("GA4: resposta parcial; totais indisponíveis.");
  return (data.rows ?? []).map((row) => {
    const channel = row.dimensionValues[0]?.value ?? "Other";
    return {
      channel,
      sessions:    requireMetric(row.metricValues[0]?.value),
      users:       requireMetric(row.metricValues[1]?.value),
      newUsers:    requireMetric(row.metricValues[2]?.value),
      bounceRate:  requireMetric(row.metricValues[3]?.value) * 100,
      conversions: requireMetric(row.metricValues[4]?.value),
      revenue:     requireMetric(row.metricValues[5]?.value),
      color:       channelColor(channel),
    };
  }).sort((a, b) => b.sessions - a.sessions);
}

export async function getGA4Summary(dateRange = { startDate: "29daysAgo", endDate: "today" }): Promise<GA4Summary> {
  if (!isGA4Configured()) throw new Error("ga4: integração não configurada.");

  const [channels, totals] = await Promise.all([
    getTrafficByChannel(dateRange),
    runReport({ dimensions: [], metrics: [{ name: "sessions" }, { name: "totalUsers" }, { name: "conversions" }, { name: "purchaseRevenue" }], dateRanges: [dateRange] }),
  ]);
  const values = totals.rows?.[0]?.metricValues;
  if (!values) throw new Error("GA4: sem métricas retornadas para este período.");
  const totalSessions = channels.reduce((s, c) => s + c.sessions, 0);

  const organicChannels = ["Organic Search", "Organic Social", "Organic Video", "Organic Shopping"];
  const paidChannels    = ["Paid Search", "Paid Social", "Cross-network"];

  const organicSessions = channels
    .filter((c) => organicChannels.includes(c.channel))
    .reduce((s, c) => s + c.sessions, 0);

  const paidSessions = channels
    .filter((c) => paidChannels.includes(c.channel))
    .reduce((s, c) => s + c.sessions, 0);

  return {
    totalSessions: requireMetric(values[0]?.value),
    totalUsers: requireMetric(values[1]?.value),
    totalConversions: requireMetric(values[2]?.value),
    totalRevenue: requireMetric(values[3]?.value),
    organicShare:    totalSessions > 0 ? (organicSessions / totalSessions) * 100 : null,
    paidShare:       totalSessions > 0 ? (paidSessions    / totalSessions) * 100 : null,
  };
}
