import { formatMoney as fmt, formatRate, formatNumber } from "../lib/dataQuality";
import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { classificarCampanha, CLASSIFICACAO_CONFIG } from "../hooks/useMarketingData";
import type { MetaAd } from "../hooks/useMarketingData";


export function AdCard({ ad }: { ad: MetaAd }) {
  const pseudo = { ...ad, objective: "", status: ad.status as "ACTIVE" | "PAUSED" | "ARCHIVED", insights: ad.insights };
  const classificacao = classificarCampanha(pseudo);
  const config = CLASSIFICACAO_CONFIG[classificacao];
  const isActive = ad.status === "ACTIVE";

  return (
    <div className={cn(
      "bg-card border rounded-xl overflow-hidden",
      classificacao === "escalavel" && "border-emerald-200 dark:border-emerald-900",
      classificacao === "matar" && "border-red-200 dark:border-red-900",
      classificacao === "monitorar" && "border-amber-200 dark:border-amber-900",
      !isActive && "opacity-70 border-border",
    )}>
      {/* Thumbnail */}
      <div className="relative w-full aspect-video bg-muted flex items-center justify-center overflow-hidden">
        {ad.thumbnailUrl ? (
          <img
            src={ad.thumbnailUrl}
            alt={ad.name}
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <div className="flex flex-col items-center gap-1 text-muted-foreground">
            <ImageIcon size={28} />
            <span className="text-[10px]">Sem prévia</span>
          </div>
        )}
        {/* Status badge */}
        <span className={cn(
          "absolute top-2 left-2 text-[9px] font-semibold px-1.5 py-0.5 rounded-full",
          isActive
            ? "bg-emerald-500 text-white"
            : "bg-muted text-muted-foreground border border-border"
        )}>
          {isActive ? "ATIVO" : "PAUSADO"}
        </span>
      </div>

      {/* Content */}
      <div className="p-3 space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium truncate">{ad.name}</p>
            {ad.creative.title && (
              <p className="text-[10px] text-muted-foreground truncate mt-0.5">{ad.creative.title}</p>
            )}
          </div>
          <span className={cn(
            "inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full border shrink-0",
            config.color
          )}>
            {config.emoji} {config.label}
          </span>
        </div>

        {ad.creative.body && (
          <p className="text-[10px] text-muted-foreground line-clamp-2 leading-relaxed">
            {ad.creative.body}
          </p>
        )}

        {/* Metrics */}
        <div className="grid grid-cols-4 gap-1.5 text-center">
          {[
            { label: "Gasto", value: fmt(ad.insights.spend) },
            {
              label: "ROAS",
              value: formatRate(ad.insights.roas, "x"),
              className:
                ad.insights.roas >= 3.5 ? "text-emerald-600 dark:text-emerald-400" :
                ad.insights.roas >= 2 ? "text-amber-600 dark:text-amber-400" :
                ad.insights.roas > 0 ? "text-red-500" : "",
            },
            { label: "CTR", value: formatRate(ad.insights.ctr) },
            { label: "Compras", value: formatNumber(ad.insights.purchases) },
          ].map(({ label, value, className }) => (
            <div key={label} className="bg-muted/40 rounded-lg p-1.5">
              <p className="text-[9px] text-muted-foreground">{label}</p>
              <p className={cn("text-[10px] font-semibold tabular-nums", className)}>{value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
