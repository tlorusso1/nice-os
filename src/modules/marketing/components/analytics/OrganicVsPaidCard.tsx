import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { TrendingUp, BadgeDollarSign } from "lucide-react";
import type { GA4Summary } from "../../api/ga4";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const fmtK = (v: number) =>
  v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v);

interface Props {
  summary: GA4Summary;
  isLoading?: boolean;
}

export function OrganicVsPaidCard({ summary, isLoading }: Props) {
  const hasShares = summary.organicShare !== null && summary.paidShare !== null;
  const remainingShare = !hasShares ? 0 : Math.max(0, 100 - summary.organicShare - summary.paidShare);

  const donutData = [
    { name: "Orgânico", value: summary.organicShare, color: "#10b981" },
    { name: "Pago",     value: summary.paidShare,    color: "#3b82f6" },
    { name: "Outros",   value: remainingShare,        color: "#e2e8f0" },
  ].filter((d) => d.value > 0);

  if (isLoading) {
    return (
      <div className="bg-card border rounded-xl p-4 space-y-3">
        <div className="h-4 w-40 bg-muted animate-pulse rounded" />
        <div className="h-32 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  if (!hasShares) return <div className="bg-card border rounded-xl p-4 text-xs text-muted-foreground">Distribuição orgânico/pago indisponível: sem sessões para calcular percentuais.</div>;

  return (
    <div className="bg-card border rounded-xl p-4">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
        Orgânico vs Pago — Tráfego (30d)
      </p>

      <div className="flex items-center gap-6">
        {/* Donut */}
        <div className="w-28 h-28 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={donutData}
                cx="50%"
                cy="50%"
                innerRadius="60%"
                outerRadius="90%"
                dataKey="value"
                startAngle={90}
                endAngle={-270}
                strokeWidth={0}
              >
                {donutData.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) => [`${value.toFixed(1)}%`, ""]}
                contentStyle={{ fontSize: 11, borderRadius: 8 }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Stats */}
        <div className="flex-1 space-y-3">
          {/* Orgânico */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
              <div>
                <p className="text-[10px] text-muted-foreground">Orgânico</p>
                <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  {summary.organicShare.toFixed(1)}%
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <TrendingUp size={10} />
              {fmtK(Math.round(summary.totalSessions * summary.organicShare / 100))} sessões
            </div>
          </div>

          {/* Pago */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
              <div>
                <p className="text-[10px] text-muted-foreground">Pago</p>
                <p className="text-sm font-bold text-blue-600 dark:text-blue-400">
                  {summary.paidShare.toFixed(1)}%
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <BadgeDollarSign size={10} />
              {fmtK(Math.round(summary.totalSessions * summary.paidShare / 100))} sessões
            </div>
          </div>

          {/* Receita total */}
          <div className="border-t pt-2">
            <p className="text-[10px] text-muted-foreground">Receita total (GA4)</p>
            <p className="text-sm font-bold">{fmt(summary.totalRevenue)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
