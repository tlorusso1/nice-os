import type { ChannelSummary } from "../hooks/useMarketingData";
import { formatMoney, formatRate } from "../lib/dataQuality";

interface Props { canal: ChannelSummary; totalSpend: number | null }
const STATUS = {
  available: "Consultado", loading: "Consultando…", error: "Indisponível",
  unconfigured: "Não configurado", unimplemented: "Não implementado",
};

export function CanalCard({ canal, totalSpend }: Props) {
  const pct = totalSpend !== null && totalSpend > 0 && canal.spend !== null ? (canal.spend / totalSpend) * 100 : null;
  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{canal.label}</span>
        <span className="text-[10px] text-muted-foreground border rounded-full px-2 py-0.5">{STATUS[canal.status]}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div><p className="text-[10px] text-muted-foreground">Investido</p><p className="text-sm font-bold">{formatMoney(canal.spend)}</p></div>
        <div><p className="text-[10px] text-muted-foreground">ROAS</p><p className="text-sm font-bold">{formatRate(canal.roas, "x")}</p></div>
      </div>
      {pct !== null && <div>
        <p className="text-[10px] text-muted-foreground mb-1">{pct.toFixed(0)}% do investimento disponível</p>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: canal.color }} /></div>
      </div>}
      <p className="text-[10px] text-muted-foreground">Fonte: {canal.label} · {canal.status === "unimplemented" ? "período indisponível" : "mês atual"}</p>
      <p className="text-[10px] text-muted-foreground">Consulta: {canal.updatedAt ? new Date(canal.updatedAt).toLocaleString("pt-BR") : "não disponível"}</p>
    </div>
  );
}
