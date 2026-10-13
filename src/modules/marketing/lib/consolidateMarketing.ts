import { sumMetrics } from "./dataQuality.ts";

type AccountMetrics = {
  spend: number | null;
  revenue: number | null;
  clicks: number | null;
};

/** Only successful, current source responses may be supplied here. */
export function consolidateMarketing(meta?: AccountMetrics, google?: AccountMetrics) {
  const accounts = [meta, google].filter((account): account is AccountMetrics => account !== undefined);
  const totalSpend = sumMetrics(accounts.map((account) => account.spend));
  const totalRevenue = sumMetrics(accounts.map((account) => account.revenue));
  return {
    totalSpend,
    totalRevenue,
    totalClicks: sumMetrics(accounts.map((account) => account.clicks)),
    roasGeral: totalSpend !== null && totalSpend > 0 && totalRevenue !== null ? totalRevenue / totalSpend : null,
    coverage: accounts.length === 2 ? "complete" as const : accounts.length === 1 ? "partial" as const : "unavailable" as const,
    sources: [meta ? "Meta Ads" : null, google ? "Google Ads" : null].filter(Boolean).join(" + "),
  };
}
