import { metric } from "./dataQuality.ts";
import type { MetaInsights } from "../api/metaAds";

export function parseInsights(raw: Record<string, unknown>): MetaInsights {
  const actions = Array.isArray(raw.actions) ? raw.actions : [];
  const values = Array.isArray(raw.action_values) ? raw.action_values : [];
  const purchases = metric(actions.find((action) => action.action_type === "purchase")?.value);
  const purchaseValue = metric(values.find((action) => action.action_type === "purchase")?.value);
  const spend = metric(raw.spend);
  return {
    spend,
    impressions: metric(raw.impressions), clicks: metric(raw.clicks), reach: metric(raw.reach),
    ctr: metric(raw.ctr), cpc: metric(raw.cpc), cpp: metric(raw.cpp), purchases, purchaseValue,
    roas: spend !== null && spend > 0 && purchaseValue !== null ? purchaseValue / spend : null,
  };
}

