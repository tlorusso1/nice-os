import { formatMoney as fmt, formatRate, formatNumber } from "../lib/dataQuality";
import { cn } from "@/lib/utils";
import { Play, Pause } from "lucide-react";
import type { MetaCampaign } from "../hooks/useMarketingData";


type AnysCampaign = MetaCampaign & { channel?: "meta" | "google" };

interface Props {
  campanha: AnysCampaign;
}

export function CampanhaRow({ campanha }: Props) {
  const { name, status, insights } = campanha;
  const isActive = (status as string) === "ACTIVE" || (status as string) === "ENABLED";

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 bg-muted/30 hover:bg-muted/60 rounded-lg transition-colors">
      {/* Status dot */}
      <span className={cn(
        "w-2 h-2 rounded-full shrink-0",
        isActive ? "bg-emerald-500" : "bg-muted-foreground/40"
      )} />

      {/* Nome + ícone */}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium truncate">{name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {isActive
            ? <span className="flex items-center gap-0.5 text-[10px] text-emerald-600 dark:text-emerald-400"><Play size={8} />Ativa</span>
            : <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground"><Pause size={8} />Pausada</span>
          }
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-3 gap-4 text-right shrink-0">
        <div>
          <p className="text-[10px] text-muted-foreground">Gasto</p>
          <p className="text-xs font-semibold tabular-nums">{fmt(insights.spend)}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground">ROAS</p>
          <p className={cn(
            "text-xs font-semibold tabular-nums",
            insights.roas === null ? "text-muted-foreground" :
            insights.roas >= 3 ? "text-emerald-600 dark:text-emerald-400" :
            insights.roas >= 2 ? "text-amber-600 dark:text-amber-400" : "text-red-500"
          )}>
            {formatRate(insights.roas, "x")}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground">Compras</p>
          <p className="text-xs font-semibold tabular-nums">{formatNumber(insights.purchases)}</p>
        </div>
      </div>
    </div>
  );
}
