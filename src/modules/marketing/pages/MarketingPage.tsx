import { formatMoney as fmt, formatCompact as fmtK, formatRate, formatNumber, currentData } from "../lib/dataQuality";
import { SourceStatus } from "../components/SourceStatus";
import { isMetaConfigured } from "../api/metaAds";
import { useState } from "react";
import {
  RefreshCw, TrendingUp, MousePointerClick, ShoppingCart,
  LayoutDashboard, BadgeDollarSign, Smartphone, BarChart3, Mail,
  Instagram, Youtube,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  useMarketingConsolidado,
  useMetaInsights,
  useMetaCampaigns,
  useGoogleCampaigns,
  useMetaAdSets,
  useMetaAds,
  useInstagramProfile,
  useInstagramMedia,
  useInstagramInsights,
  useYouTubeStats,
  useYouTubeVideos,
  useGA4TrafficByChannel,
  useGA4Summary,
  usePerfitCampaigns,
  usePerfitSummary,
} from "../hooks/useMarketingData";
import { isGoogleConfigured } from "../api/googleAds";
import { isInstagramConfigured } from "../api/instagram";
import { isYouTubeConfigured } from "../api/youtube";
import { isGA4Configured } from "../api/ga4";
import { isPerfitConfigured } from "../api/perfit";
import { CanalCard } from "../components/CanalCard";
import { CampanhaCard } from "../components/CampanhaCard";
import { AdSetCard } from "../components/AdSetCard";
import { AdCard } from "../components/AdCard";
import { BulkUploadPanel } from "../components/BulkUploadPanel";
import { IGProfileCard } from "../components/instagram/IGProfileCard";
import { IGInsightsBar } from "../components/instagram/IGInsightsBar";
import { IGMediaGrid } from "../components/instagram/IGMediaGrid";
import { YTChannelCard } from "../components/youtube/YTChannelCard";
import { YTVideoList } from "../components/youtube/YTVideoList";
import { GA4TrafficChart, GA4RevenueChart } from "../components/analytics/GA4TrafficChart";
import { GA4ChannelTable } from "../components/analytics/GA4ChannelTable";
import { OrganicVsPaidCard } from "../components/analytics/OrganicVsPaidCard";
import { PerfitSummaryBar } from "../components/email/PerfitSummaryBar";
import { PerfitCampaignCard } from "../components/email/PerfitCampaignCard";

// ─── Types ────────────────────────────────────────────────────
type Section    = "overview" | "ads" | "social" | "analytics" | "email";
type AdsTab     = "campanhas" | "publicos" | "criativos" | "upload";
type SocialTab  = "instagram" | "youtube";

const TOP_SECTIONS: { id: Section; label: string; icon: React.ElementType }[] = [
  { id: "overview",   label: "Visão Geral", icon: LayoutDashboard  },
  { id: "ads",        label: "Ads",         icon: BadgeDollarSign  },
  { id: "social",     label: "Social",      icon: Smartphone       },
  { id: "analytics",  label: "Analytics",   icon: BarChart3        },
  { id: "email",      label: "Email",        icon: Mail             },
];

const ADS_TABS: { id: AdsTab; label: string }[] = [
  { id: "campanhas", label: "Campanhas"  },
  { id: "publicos",  label: "Públicos"   },
  { id: "criativos", label: "Criativos"  },
  { id: "upload",    label: "Upload"     },
];

const SOCIAL_TABS: { id: SocialTab; label: string; icon: React.ElementType }[] = [
  { id: "instagram", label: "Instagram", icon: Instagram },
  { id: "youtube",   label: "YouTube",   icon: Youtube   },
];

// ─── Page ─────────────────────────────────────────────────────
export default function MarketingPage() {
  const [section,    setSection]    = useState<Section>("overview");
  const [adsTab,     setAdsTab]     = useState<AdsTab>("campanhas");
  const [socialTab,  setSocialTab]  = useState<SocialTab>("instagram");

  const qc = useQueryClient();
  const { totalSpend, totalRevenue, totalClicks, roasGeral, channels, isLoading, coverage, sources } = useMarketingConsolidado();
  const metaInsights   = useMetaInsights();
  const metaCampaigns  = useMetaCampaigns();
  const googleCampaigns = useGoogleCampaigns();
  const metaAdSets     = useMetaAdSets();
  const metaAds        = useMetaAds();

  const meta = currentData(metaInsights);
  const campaignData = currentData(metaCampaigns);
  const googleCampaignData = currentData(googleCampaigns);

  const allCampaigns = [
    ...(campaignData ?? []).map((c) => ({ ...c, channel: "meta" as const })),
    ...(isGoogleConfigured()
      ? (googleCampaignData ?? []).map((c) => ({
          id: c.id,
          name: c.name,
          status: c.status === "ENABLED" ? "ACTIVE" as const : "PAUSED" as const,
          objective: c.type,
          dailyBudget: c.budget,
          insights: {
            spend: c.spend, impressions: c.impressions, clicks: c.clicks,
            reach: null, ctr: c.ctr, cpc: c.cpc, cpp: null,
            purchases: c.conversions, purchaseValue: c.conversionValue, roas: c.roas,
          },
          channel: "google" as const,
        }))
      : []),
  ].sort((a, b) => (b.insights.spend ?? -1) - (a.insights.spend ?? -1));

  const adsets = [...(currentData(metaAdSets) ?? [])].sort((a, b) => (b.insights.spend ?? -1) - (a.insights.spend ?? -1));
  const ads    = [...(currentData(metaAds) ?? [])].sort((a, b) => (b.insights.spend ?? -1) - (a.insights.spend ?? -1));

  // Social
  const igProfile  = useInstagramProfile();
  const igMedia    = useInstagramMedia();
  const igInsights = useInstagramInsights();
  const ytStats    = useYouTubeStats();
  const ytVideos   = useYouTubeVideos();

  // Analytics
  const ga4Traffic  = useGA4TrafficByChannel();
  const ga4Summary  = useGA4Summary();

  // Email
  const perfitCampaigns = usePerfitCampaigns();
  const perfitSummary   = usePerfitSummary();

  const igProfileData = currentData(igProfile);
  const igMediaData = currentData(igMedia);
  const igInsightsData = currentData(igInsights);
  const ytStatsData = currentData(ytStats);
  const ytVideosData = currentData(ytVideos);
  const ga4TrafficData = currentData(ga4Traffic);
  const ga4SummaryData = currentData(ga4Summary);
  const perfitCampaignsData = currentData(perfitCampaigns);
  const perfitSummaryData = currentData(perfitSummary);
  return (
    <div className="flex flex-col animate-fade-in">

      {/* ─── Header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2 md:px-6 md:pt-6">
        <div>
          <h1 className="text-lg font-semibold">Marketing & Ads</h1>
          <p className="text-xs text-muted-foreground">
            {"Fonte, período e disponibilidade por integração"}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => qc.invalidateQueries({ queryKey: ["marketing"] })}
          className="gap-1.5"
        >
          <RefreshCw size={13} />
          Atualizar
        </Button>
      </div>

      {/* ─── Top-level section tabs ──────────────────────────── */}
      <div className="px-4 md:px-6 pb-3">
        <div className="flex gap-1 bg-muted/40 p-1 rounded-xl overflow-x-auto scrollbar-none">
          {TOP_SECTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setSection(id)}
              className={cn(
                "flex items-center gap-1.5 text-xs font-medium py-2 px-3 rounded-lg whitespace-nowrap transition-colors shrink-0",
                section === id
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-4 md:mx-6 mb-4 space-y-2">
        {(section === "overview" || section === "ads") && <>
          <SourceStatus source="Meta Ads" period="Mês atual, no fuso da conta de anúncios" configured={isMetaConfigured()} queries={section === "overview" ? [metaInsights] : adsTab === "campanhas" ? [metaCampaigns] : adsTab === "publicos" || adsTab === "upload" ? [metaAdSets] : [metaAds]} />
          <SourceStatus source="Google Ads" period="Não disponível" configured={false} queries={[]} unavailableReason="Integração ainda não implementada" />
        </>}
        {section === "social" && socialTab === "instagram" && <SourceStatus source="Instagram" period="Perfil atual; insights dos últimos 30 dias; até 20 posts recentes" configured={isInstagramConfigured()} queries={[igProfile, igInsights, igMedia]} />}
        {section === "social" && socialTab === "youtube" && <SourceStatus source="YouTube" period="Totais acumulados do canal e até 10 vídeos recentes" configured={isYouTubeConfigured()} queries={[ytStats, ytVideos]} />}
        {section === "analytics" && <SourceStatus source="Google Analytics 4" period="29 dias atrás até hoje, inclusive, no fuso da propriedade" configured={isGA4Configured()} queries={[ga4Summary, ga4Traffic]} />}
        {section === "email" && <SourceStatus source="Perfit" period="Resumo sem período informado pela API; até 20 campanhas" configured={isPerfitConfigured()} queries={[perfitSummary, perfitCampaigns]} />}
      </div>

      {/* ══════════════════════════════════════════════════════
          SEÇÃO: VISÃO GERAL
      ══════════════════════════════════════════════════════ */}
      {section === "overview" && (
        <div className="space-y-5 px-4 md:px-6 pb-8">
          <p className="text-xs text-muted-foreground">
            {coverage === "unavailable" ? "Sem métricas disponíveis. Campos ausentes aparecem como —." :
              `${coverage === "partial" ? "Consolidado parcial" : "Consolidado"} · fontes incluídas: ${sources}. Dados indisponíveis não entram como zero.`}
          </p>
          {coverage !== "unavailable" && <p className="text-xs text-muted-foreground">Receita atribuída pelas plataformas; pode haver sobreposição entre canais.</p>}
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            {[
              {
                label: "Investimento disponível",
                value: isLoading ? null : fmt(totalSpend),
                icon: <ShoppingCart size={13} className="text-muted-foreground" />,
                sub: "este mês",
              },
              {
                label: "Receita atribuída disponível",
                value: isLoading ? null : fmt(totalRevenue),
                icon: <TrendingUp size={13} className="text-emerald-500" />,
                sub: "via ads",
              },
              {
                label: "ROAS disponível",
                value: isLoading ? null : formatRate(roasGeral, "x"),
                icon: null,
                sub: roasGeral === null ? "Sem base para avaliar" : roasGeral >= 3 ? "✅ Saudável" : roasGeral >= 2 ? "⚠️ Atenção" : "🔴 Baixo",
                valueColor:
                  roasGeral === null ? "text-muted-foreground" : roasGeral >= 3
                    ? "text-emerald-600 dark:text-emerald-400"
                    : roasGeral >= 2
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-red-500",
              },
              {
                label: "Cliques disponíveis",
                value: isLoading ? null : fmtK(totalClicks),
                icon: <MousePointerClick size={13} className="text-muted-foreground" />,
                sub: `CTR Meta: ${formatRate(meta?.ctr, "%", 1)}`,
              },
            ].map(({ label, value, icon, sub, valueColor }) => (
              <div key={label} className="metric-card">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  {icon}
                  {label}
                </div>
                {value === null ? (
                  <div className="h-7 w-24 bg-muted animate-pulse rounded mt-1" />
                ) : (
                  <span className={`text-xl font-bold ${valueColor ?? ""}`}>{value}</span>
                )}
                <p className="text-[10px] text-muted-foreground">{sub}</p>
              </div>
            ))}
          </div>

          {/* Canais */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Canais
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {channels.map((canal) => (
                <CanalCard key={canal.channel} canal={canal} totalSpend={totalSpend} />
              ))}
            </div>
          </div>

          {/* Meta detalhes */}
          {meta && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Meta Ads — Detalhes
              </p>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                {[
                  { label: "Impressões", value: fmtK(meta.impressions) },
                  { label: "Alcance",    value: fmtK(meta.reach)       },
                  { label: "Cliques",    value: fmtK(meta.clicks)      },
                  { label: "CTR",        value: formatRate(meta.ctr) },
                  { label: "CPC",        value: fmt(meta.cpc)          },
                  { label: "Compras",    value: formatNumber(meta.purchases)  },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-muted/40 rounded-lg p-2.5 text-center">
                    <p className="text-[10px] text-muted-foreground mb-0.5">{label}</p>
                    <p className="text-xs font-semibold">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          SEÇÃO: ADS
      ══════════════════════════════════════════════════════ */}
      {section === "ads" && (
        <div className="flex flex-col px-4 md:px-6 pb-8 gap-4">
          {/* Ads sub-tabs */}
          <div className="flex gap-1 bg-muted/40 p-1 rounded-lg">
            {ADS_TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setAdsTab(t.id)}
                className={cn(
                  "flex-1 text-xs font-medium py-1.5 px-2 rounded-md transition-colors",
                  adsTab === t.id
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Campanhas */}
          {adsTab === "campanhas" && (
            <>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider -mb-2">
                Campanhas ({campaignData || googleCampaignData ? allCampaigns.length : "—"}) · até 20 por fonte
              </p>
              {metaCampaigns.isLoading || googleCampaigns.isLoading ? (
                <div className="space-y-2">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-14 bg-muted animate-pulse rounded-lg" />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {allCampaigns.length === 0 && <p className="text-sm text-muted-foreground">{campaignData || googleCampaignData ? "Nenhuma campanha retornada." : "Campanhas indisponíveis."}</p>}
                  {allCampaigns.map((c) => (
                    <CampanhaCard key={`${c.channel}-${c.id}`} campanha={c} />
                  ))}
                </div>
              )}
            </>
          )}

          {/* Públicos */}
          {adsTab === "publicos" && (
            <>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider -mb-2">
                Públicos / Ad Sets ({currentData(metaAdSets) ? adsets.length : "—"}) · até 30
              </p>
              {metaAdSets.isLoading ? (
                <div className="space-y-2">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />
                  ))}
                </div>
              ) : adsets.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  {currentData(metaAdSets) ? "Nenhum público retornado." : "Públicos indisponíveis."}
                </div>
              ) : (
                <div className="space-y-2">
                  {adsets.map((as) => (
                    <AdSetCard key={as.id} adset={as} />
                  ))}
                </div>
              )}
            </>
          )}

          {/* Criativos */}
          {adsTab === "criativos" && (
            <>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider -mb-2">
                Criativos / Ads ({currentData(metaAds) ? ads.length : "—"}) · até 50
              </p>
              {metaAds.isLoading ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="aspect-[3/4] bg-muted animate-pulse rounded-xl" />
                  ))}
                </div>
              ) : ads.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  {currentData(metaAds) ? "Nenhum criativo retornado." : "Criativos indisponíveis."}
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {ads.map((ad) => (
                    <AdCard key={ad.id} ad={ad} />
                  ))}
                </div>
              )}
            </>
          )}

          {/* Bulk Upload */}
          {adsTab === "upload" && (
            <>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider -mb-2">
                Upload em massa de criativos
              </p>
              {isMetaConfigured() && !metaAdSets.isError ? <BulkUploadPanel adSets={adsets} /> : <p className="text-sm text-muted-foreground">Upload indisponível sem integração Meta Ads e consulta de públicos válida.</p>}
            </>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          SEÇÃO: SOCIAL
      ══════════════════════════════════════════════════════ */}
      {section === "social" && (
        <div className="flex flex-col px-4 md:px-6 pb-8 gap-4">
          {/* Social sub-tabs */}
          <div className="flex gap-1 bg-muted/40 p-1 rounded-lg">
            {SOCIAL_TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setSocialTab(id)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-1.5 px-2 rounded-md transition-colors",
                  socialTab === id
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon size={12} />
                {label}
              </button>
            ))}
          </div>

          {/* Instagram */}
          {socialTab === "instagram" && (
            <div className="space-y-4">
              {igProfileData && <IGProfileCard profile={igProfileData} />}
              {igInsightsData && (
                <IGInsightsBar insights={igInsightsData} isLoading={igInsights.isLoading} />
              )}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Posts recentes
                </p>
                {(igMediaData || igMedia.isLoading) && <IGMediaGrid media={igMediaData ?? []} isLoading={igMedia.isLoading} />}
              </div>
            </div>
          )}

          {/* YouTube */}
          {socialTab === "youtube" && (
            <div className="space-y-4">
              {ytStatsData && <YTChannelCard stats={ytStatsData} />}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Vídeos recentes ({ytVideosData?.length ?? "—"})
                </p>
                {(ytVideosData || ytVideos.isLoading) && <YTVideoList videos={ytVideosData ?? []} isLoading={ytVideos.isLoading} />}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          SEÇÃO: ANALYTICS
      ══════════════════════════════════════════════════════ */}
      {section === "analytics" && (
        <div className="px-4 md:px-6 pb-8 space-y-4">
          {/* KPIs de resumo */}
          {ga4SummaryData && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
              {[
                { label: "Sessões (30d)",  value: ga4SummaryData.totalSessions.toLocaleString("pt-BR"),  color: "text-foreground" },
                { label: "Usuários",       value: ga4SummaryData.totalUsers.toLocaleString("pt-BR"),      color: "text-foreground" },
                { label: "Conversões",     value: ga4SummaryData.totalConversions.toLocaleString("pt-BR"), color: "text-emerald-600 dark:text-emerald-400" },
                { label: "Receita (GA4)",  value: new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(ga4SummaryData.totalRevenue), color: "text-emerald-600 dark:text-emerald-400" },
              ].map(({ label, value, color }) => (
                <div key={label} className="metric-card">
                  <p className="text-xs text-muted-foreground mb-1">{label}</p>
                  {ga4Summary.isLoading
                    ? <div className="h-7 w-20 bg-muted animate-pulse rounded" />
                    : <span className={`text-xl font-bold ${color}`}>{value}</span>
                  }
                </div>
              ))}
            </div>
          )}

          {/* Orgânico vs Pago */}
          {ga4SummaryData && (
            <OrganicVsPaidCard summary={ga4SummaryData} isLoading={ga4Summary.isLoading} />
          )}

          {/* Charts */}
          {ga4TrafficData?.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma linha retornada para este período.</p>}
          {!!ga4TrafficData?.length && <>
          <GA4TrafficChart data={ga4TrafficData ?? []} isLoading={ga4Traffic.isLoading} />
          <GA4RevenueChart data={ga4TrafficData ?? []} isLoading={ga4Traffic.isLoading} />

          {/* Table */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Detalhes por canal
            </p>
            <GA4ChannelTable data={ga4TrafficData} isLoading={ga4Traffic.isLoading} />
          </div>
          </>}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          SEÇÃO: EMAIL
      ══════════════════════════════════════════════════════ */}
      {section === "email" && (
        <div className="px-4 md:px-6 pb-8 space-y-4">
          {/* KPIs de resumo */}
          {perfitSummaryData && (
            <PerfitSummaryBar summary={perfitSummaryData} isLoading={perfitSummary.isLoading} />
          )}

          {/* Lista de campanhas */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Campanhas ({perfitCampaignsData?.length ?? "—"})
            </p>
            {perfitCampaigns.isLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-32 bg-muted animate-pulse rounded-xl" />
                ))}
              </div>
            ) : perfitCampaignsData?.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                Nenhuma campanha encontrada.
              </div>
            ) : (
              <div className="space-y-3">
                {(perfitCampaignsData ?? []).map((campaign) => (
                  <PerfitCampaignCard key={campaign.id} campaign={campaign} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
