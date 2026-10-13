import { formatMoney as fmt, formatCompact as fmtK, formatRate } from "../lib/dataQuality";
import { Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { classificarCampanha, CLASSIFICACAO_CONFIG } from "../hooks/useMarketingData";
import type { MetaAdSet } from "../hooks/useMarketingData";


function targetingLabel(t: MetaAdSet["targeting"]): string {
  const parts: string[] = [];
  if (t.age_min || t.age_max) parts.push(`${t.age_min ?? "?"}-${t.age_max ?? "?"}a`);
  if (t.genders?.length === 1) parts.push(t.genders[0] === 1 ? "Homens" : "Mulheres");
  const pais = t.geo_locations?.countries?.[0];
  if (pais) parts.push(pais);
  return parts.join(" · ") || "Segmentação ampla";
}

export function AdSetCard({ adset }: { adset: MetaAdSet }) {
  // Adapta para a função classificarCampanha (que espera MetaCampaign)
  const pseudo = { ...adset, objective: "", insights: adset.insights };
  const classificacao = classificarCampanha(pseudo);
  const config = CLASSIFICACAO_CONFIG[classificacao];
  const isActive = adset.status === "ACTIVE";

  return (
    <div className={cn(
      "bg-card border rounded-xl p-4 space-y-3",
      classificacao === "escalavel" && "border-emerald-200 dark:border-emerald-900",
      classificacao === "matar" && "border-red-200 dark:border-red-900",
      classificacao === "monitorar" && "border-amber-200 dark:border-amber-900",
      !isActive && "opacity-70 border-border",
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{adset.name}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Users size={10} className="text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">{targetingLabel(adset.targeting)}</span>
          </div>
        </div>
        <span className={cn(
          "inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full border shrink-0",
          config.color
        )}>
          {config.emoji} {config.label}
        </span>
      </div>

      <div className="grid grid-cols-4 gap-2 text-center">
        {[
          { label: "Gasto", value: fmt(adset.insights.spend) },
          { label: "ROAS", value: formatRate(adset.insights.roas, "x"),
            className: adset.insights.roas >= 3.5 ? "text-emerald-600 dark:text-emerald-400" :
              adset.insights.roas >= 2 ? "text-amber-600 dark:text-amber-400" :
              adset.insights.roas > 0 ? "text-red-500" : "" },
          { label: "Alcance", value: fmtK(adset.insights.reach) },
          { label: "CTR", value: formatRate(adset.insights.ctr) },
        ].map(({ label, value, className }) => (
          <div key={label} className="bg-muted/40 rounded-lg p-2">
            <p className="text-[10px] text-muted-foreground">{label}</p>
            <p className={cn("text-xs font-semibold tabular-nums", className)}>{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
