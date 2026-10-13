/** Google Ads has no live adapter yet. Configuration flags cannot enable one. */

export interface GoogleCampaign {
  id: string;
  name: string;
  status: "ENABLED" | "PAUSED" | "REMOVED";
  type: string;
  budget: number;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  conversions: number;
  conversionValue: number;
  roas: number;
}

export interface GoogleAccountInsights {
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  conversions: number;
  conversionValue: number;
  roas: number;
}

/** No live adapter exists yet. A flag alone must never claim a connection. */
export function isGoogleConfigured(): boolean {
  return false;
}

export async function getGoogleAccountInsights(): Promise<GoogleAccountInsights> {
  throw new Error("Google Ads: integração ainda não implementada.");
}

export async function getGoogleCampaigns(): Promise<GoogleCampaign[]> {
  throw new Error("Google Ads: integração ainda não implementada.");
}
