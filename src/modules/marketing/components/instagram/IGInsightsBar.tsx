import { formatCompact as fmtK } from "../../lib/dataQuality";
import { Eye, Users, MousePointer, TrendingUp } from "lucide-react";
import type { IGAccountInsights } from "../../hooks/useMarketingData";


interface Props {
  insights: IGAccountInsights;
  isLoading?: boolean;
}

export function IGInsightsBar({ insights, isLoading }: Props) {
  const kpis = [
    {
      label: "Alcance diário somado (30d)",
      value: fmtK(insights.reach),
      icon: <TrendingUp size={13} className="text-purple-500" />,
      color: "text-purple-600 dark:text-purple-400",
    },
    {
      label: "Impressões",
      value: fmtK(insights.impressions),
      icon: <Eye size={13} className="text-pink-500" />,
      color: "text-pink-600 dark:text-pink-400",
    },
    {
      label: "Visitas ao perfil",
      value: fmtK(insights.profileViews),
      icon: <MousePointer size={13} className="text-orange-500" />,
      color: "text-orange-600 dark:text-orange-400",
    },
    {
      label: "Seguidores (soma diária)",
      value: fmtK(insights.followerCount),
      icon: <Users size={13} className="text-emerald-500" />,
      color: "text-emerald-600 dark:text-emerald-400",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
      {kpis.map(({ label, value, icon, color }) => (
        <div key={label} className="metric-card">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
            {icon}
            {label}
          </div>
          {isLoading ? (
            <div className="h-7 w-20 bg-muted animate-pulse rounded" />
          ) : (
            <span className={`text-xl font-bold ${color}`}>{value}</span>
          )}
        </div>
      ))}
    </div>
  );
}
