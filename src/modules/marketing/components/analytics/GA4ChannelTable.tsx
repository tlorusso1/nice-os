import { ArrowUpDown } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { GA4ChannelBreakdown } from "../../api/ga4";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const fmtK = (v: number) =>
  v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v);
const fmtPct = (v: number) =>
  `${v.toFixed(1)}%`;

type SortKey = "sessions" | "users" | "conversions" | "revenue" | "bounceRate";

interface Props {
  data: GA4ChannelBreakdown[];
  isLoading?: boolean;
}

export function GA4ChannelTable({ data, isLoading }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("sessions");
  const [sortAsc, setSortAsc] = useState(false);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((v) => !v);
    else { setSortKey(key); setSortAsc(false); }
  }

  const sorted = [...data].sort((a, b) =>
    sortAsc ? a[sortKey] - b[sortKey] : b[sortKey] - a[sortKey]
  );

  const headers: { key: SortKey; label: string; hideOnMobile?: boolean }[] = [
    { key: "sessions",    label: "Sessões"      },
    { key: "users",       label: "Usuários",    hideOnMobile: true },
    { key: "bounceRate",  label: "Bounce",      hideOnMobile: true },
    { key: "conversions", label: "Conversões"   },
    { key: "revenue",     label: "Receita"      },
  ];

  if (isLoading) {
    return (
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="p-4 space-y-2">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="h-9 bg-muted animate-pulse rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground">Canal</th>
              {headers.map(({ key, label, hideOnMobile }) => (
                <th
                  key={key}
                  className={cn(
                    "text-right px-3 py-2.5 font-semibold text-muted-foreground cursor-pointer hover:text-foreground select-none whitespace-nowrap",
                    hideOnMobile && "hidden md:table-cell"
                  )}
                  onClick={() => toggleSort(key)}
                >
                  <span className="flex items-center justify-end gap-1">
                    {label}
                    <ArrowUpDown size={10} className={sortKey === key ? "text-primary" : "opacity-30"} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr
                key={row.channel}
                className={cn(
                  "border-b last:border-0 hover:bg-muted/20 transition-colors",
                  i % 2 === 0 ? "" : "bg-muted/10"
                )}
              >
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: row.color }}
                    />
                    <span className="font-medium text-[11px] leading-tight">{row.channel}</span>
                  </div>
                </td>
                <td className="text-right px-3 py-2.5 tabular-nums font-medium">
                  {fmtK(row.sessions)}
                </td>
                <td className="text-right px-3 py-2.5 tabular-nums text-muted-foreground hidden md:table-cell">
                  {fmtK(row.users)}
                </td>
                <td className={cn(
                  "text-right px-3 py-2.5 tabular-nums hidden md:table-cell",
                  row.bounceRate > 60 ? "text-red-500" :
                  row.bounceRate > 40 ? "text-amber-600 dark:text-amber-400" :
                  "text-emerald-600 dark:text-emerald-400"
                )}>
                  {fmtPct(row.bounceRate)}
                </td>
                <td className="text-right px-3 py-2.5 tabular-nums">
                  {fmtK(row.conversions)}
                </td>
                <td className="text-right px-3 py-2.5 tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
                  {fmt(row.revenue)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t bg-muted/20 font-semibold">
              <td className="px-4 py-2.5 text-[11px]">Total</td>
              <td className="text-right px-3 py-2.5 tabular-nums">
                {fmtK(data.reduce((s, d) => s + d.sessions, 0))}
              </td>
              <td className="text-right px-3 py-2.5 tabular-nums text-muted-foreground hidden md:table-cell">
                <span title="Usuários podem aparecer em mais de um canal; use o total deduplicado do resumo.">—</span>
              </td>
              <td className="hidden md:table-cell" />
              <td className="text-right px-3 py-2.5 tabular-nums">
                {data.reduce((s, d) => s + d.conversions, 0)}
              </td>
              <td className="text-right px-3 py-2.5 tabular-nums text-emerald-600 dark:text-emerald-400">
                {fmt(data.reduce((s, d) => s + d.revenue, 0))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
