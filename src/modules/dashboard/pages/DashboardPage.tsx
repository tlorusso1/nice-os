import { useQuery } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, Minus, RefreshCw, AlertTriangle, ArrowRight } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import {
  useAsaasBalance,
  useAsaasReceivables,
  useAsaasOverdue,
  useTinyPedidosMes,
} from "@/modules/financeiro/hooks/useFinanceiroData";
import { getBlingContasPagar } from "@/modules/financeiro/api/bling";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

// ── helpers ─────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

function mesPt(offset = 0) {
  const d = new Date();
  d.setMonth(d.getMonth() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function nomeMes(yyyymm: string) {
  const [y, m] = yyyymm.split("-");
  return new Date(Number(y), Number(m) - 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function diasRestantes(dueDate: string) {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const due  = new Date(dueDate + "T00:00:00");
  return Math.ceil((due.getTime() - hoje.getTime()) / 86400000);
}

// ── canal config ────────────────────────────────────────────────────────────

const CANAL_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  nuvemshop: { label: "Nuvemshop", color: "#2B7FFF", bg: "#EFF6FF" },
  shopee:    { label: "Shopee",    color: "#FF6B00", bg: "#FFF7ED" },
  ritz_pay:  { label: "Ritz Pay",  color: "#E8A838", bg: "#FFFBEB" },
  nice_sp:   { label: "Nice SP",   color: "#4DC98A", bg: "#F0FDF4" },
  b2b_tiny:  { label: "B2B",       color: "#7C3AED", bg: "#F5F3FF" },
};

// ── sub-components ───────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, loading, alert = false,
}: { label: string; value: string; sub?: React.ReactNode; loading?: boolean; alert?: boolean }) {
  return (
    <div className={cn(
      "rounded-xl border p-4 flex flex-col gap-1",
      alert ? "border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900" : "bg-card"
    )}>
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
      {loading ? (
        <Skeleton className="h-7 w-32 mt-1" />
      ) : (
        <p className={cn("text-2xl font-bold tabular-nums", alert && "text-red-600 dark:text-red-400")}>{value}</p>
      )}
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

function Delta({ pct }: { pct: number }) {
  if (pct === 0) return <span className="flex items-center gap-0.5 text-muted-foreground"><Minus size={11} />0%</span>;
  const up = pct > 0;
  return (
    <span className={cn("flex items-center gap-0.5 font-semibold", up ? "text-emerald-600" : "text-red-500")}>
      {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      {up ? "+" : ""}{pct.toFixed(1)}%
    </span>
  );
}

function CanalCard({
  canal, atual, anterior, loading,
}: { canal: string; atual: number; anterior: number; loading: boolean }) {
  const cfg = CANAL_CONFIG[canal] ?? { label: canal, color: "#888", bg: "#F5F5F5" };
  const pct = anterior > 0 ? ((atual - anterior) / anterior) * 100 : atual > 0 ? 100 : 0;

  return (
    <div className="rounded-xl border p-4 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: cfg.color }} />
        <span className="text-xs font-medium text-muted-foreground">{cfg.label}</span>
      </div>
      {loading ? (
        <Skeleton className="h-6 w-24" />
      ) : (
        <>
          <p className="text-xl font-bold tabular-nums">{fmt(atual)}</p>
          <Delta pct={pct} />
        </>
      )}
    </div>
  );
}

// ── main page ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [syncing, setSyncing] = useState(false);

  const sincronizar = async () => {
    setSyncing(true);
    try {
      await supabase.functions.invoke("sync-vendas", { body: { mode: "month" } });
      await qc.invalidateQueries();
      toast.success("Vendas sincronizadas");
    } catch {
      toast.error("Falha ao sincronizar vendas");
    } finally {
      setSyncing(false);
    }
  };


  const mesAtual    = mesPt(0);
  const mesAnterior = mesPt(-1);

  // Faturamento por canal (mês atual + anterior)
  const { data: vendasData, isLoading: vendasLoading } = useQuery({
    queryKey: ["vendas_canais", "dashboard", mesAtual, mesAnterior],
    queryFn: async () => {
      const { data } = await supabase
        .from("vendas_canais")
        .select("mes, canal, faturamento")
        .in("mes", [`${mesAtual}-01`, `${mesAnterior}-01`]);
      return data ?? [];
    },
    staleTime: 1000 * 60 * 5,
  });

  // Financeiro
  const balanceQ  = useAsaasBalance();
  const recQ      = useAsaasReceivables();
  const overdueQ  = useAsaasOverdue();
  const tinyQ     = useTinyPedidosMes();

  const { data: pagarData, isLoading: pagarLoading } = useQuery({
    queryKey: ["bling", "contas-pagar", "dashboard"],
    queryFn: getBlingContasPagar,
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });

  // ── Deriva os valores ─────────────────────────────────────────────────────

  const atual:    Record<string, number> = {};
  const anterior: Record<string, number> = {};
  (vendasData ?? []).forEach((r: any) => {
    const mesKey = typeof r.mes === "string" ? r.mes.slice(0, 7) : "";
    const val = Number(r.faturamento) || 0;
    if (mesKey === mesAtual)    atual[r.canal]    = (atual[r.canal]    ?? 0) + val;
    if (mesKey === mesAnterior) anterior[r.canal] = (anterior[r.canal] ?? 0) + val;
  });

  const totalAtual    = Object.values(atual).reduce((s, v) => s + v, 0);
  const totalAnterior = Object.values(anterior).reduce((s, v) => s + v, 0);
  const varTotal      = totalAnterior > 0 ? ((totalAtual - totalAnterior) / totalAnterior) * 100 : 0;

  const saldoAsaas  = balanceQ.data?.balance ?? 0;
  const totalReceber = (recQ.data?.data ?? []).reduce((s, c) => s + c.value, 0);
  const totalVencido = (overdueQ.data?.data ?? []).reduce((s, c) => s + c.value, 0);
  const totalPagar   = (pagarData?.data ?? []).reduce((s, c) => s + c.valor, 0);

  const situacoesOk  = ["aprovado", "pronto para envio", "enviado", "entregue"];
  const fatB2B       = (tinyQ.data ?? [])
    .filter((p) => situacoesOk.includes(p.situacao?.toLowerCase() ?? ""))
    .reduce((s, p) => s + (p.valor ?? 0), 0);

  const overdueList = (overdueQ.data?.data ?? [])
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, 6);

  const pagarList = (pagarData?.data ?? [])
    .sort((a, b) => new Date(a.vencimento).getTime() - new Date(b.vencimento).getTime())
    .slice(0, 6);

  const canais = Object.keys(CANAL_CONFIG);

  const hoje = new Date().toLocaleDateString("pt-BR", {
    weekday: "long", day: "numeric", month: "long",
  });

  return (
    <div className="flex flex-col animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 md:px-6 md:pt-6">
        <div>
          <h1 className="text-lg font-semibold">Visão Geral</h1>
          <p className="text-xs text-muted-foreground capitalize">{hoje}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={sincronizar} disabled={syncing} className="gap-1.5">
            <RefreshCw size={13} className={syncing ? "animate-spin" : undefined} />
            Sincronizar vendas
          </Button>
          <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries()} className="gap-1.5">
            <RefreshCw size={13} />
            Atualizar
          </Button>
        </div>

      </div>

      <div className="px-4 md:px-6 space-y-5 pb-10">

        {/* KPI row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard
            label="Faturamento"
            value={fmt(totalAtual)}
            loading={vendasLoading}
            sub={<Delta pct={varTotal} />}
          />
          <KpiCard
            label="Saldo Asaas"
            value={fmt(saldoAsaas)}
            loading={balanceQ.isLoading}
          />
          <KpiCard
            label="A Receber"
            value={fmt(totalReceber)}
            loading={recQ.isLoading}
            sub={`${(recQ.data?.data ?? []).length} cobranças pendentes`}
          />
          <KpiCard
            label="Cobranças Vencidas"
            value={fmt(totalVencido)}
            loading={overdueQ.isLoading}
            alert={totalVencido > 0}
            sub={`${overdueList.length} em atraso`}
          />
        </div>

        {/* Faturamento por canal */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold">
              Faturamento por Canal — {nomeMes(mesAtual)}
            </h2>
            <button
              onClick={() => navigate("/canais")}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Ver detalhes <ArrowRight size={11} />
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {canais.map((c) => (
              <CanalCard
                key={c}
                canal={c}
                atual={atual[c] ?? 0}
                anterior={anterior[c] ?? 0}
                loading={vendasLoading}
              />
            ))}
          </div>
        </div>

        {/* A Pagar + Vencidas */}
        <div className="grid md:grid-cols-2 gap-4">

          {/* Cobranças Vencidas */}
          <div className="rounded-xl border p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold flex items-center gap-1.5">
                <AlertTriangle size={13} className="text-red-500" />
                Cobranças Vencidas
              </h2>
              <button
                onClick={() => navigate("/financeiro")}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                Ver todas <ArrowRight size={11} />
              </button>
            </div>
            {overdueQ.isLoading ? (
              <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : overdueList.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma cobrança vencida</p>
            ) : (
              <div className="space-y-1.5">
                {overdueList.map((c) => {
                  const dias = diasRestantes(c.dueDate);
                  return (
                    <div key={c.id} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate max-w-[180px]">
                          {c.description || "Cobrança"}
                        </p>
                        <p className="text-xs text-red-500">{Math.abs(dias)} dias em atraso</p>
                      </div>
                      <p className="text-sm font-semibold text-red-600 tabular-nums shrink-0 ml-2">
                        {fmt(c.value)}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* A Pagar (Bling) */}
          <div className="rounded-xl border p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">A Pagar</h2>
              <span className="text-xs font-semibold text-muted-foreground tabular-nums">
                {pagarLoading ? "—" : fmt(totalPagar)}
              </span>
            </div>
            {pagarLoading ? (
              <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : pagarList.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma conta a pagar</p>
            ) : (
              <div className="space-y-1.5">
                {pagarList.map((c) => {
                  const dias = diasRestantes(c.vencimento);
                  const vencida = dias < 0;
                  const urgente = dias >= 0 && dias <= 3;
                  return (
                    <div key={c.id} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate max-w-[180px]">
                          {c.fornecedor?.nome ?? c.historico ?? "Fornecedor"}
                        </p>
                        <p className={cn(
                          "text-xs",
                          vencida ? "text-red-500" : urgente ? "text-amber-500" : "text-muted-foreground"
                        )}>
                          {vencida
                            ? `${Math.abs(dias)}d em atraso`
                            : dias === 0 ? "Vence hoje"
                            : `em ${dias}d`}
                        </p>
                      </div>
                      <p className={cn(
                        "text-sm font-semibold tabular-nums shrink-0 ml-2",
                        vencida ? "text-red-600" : urgente ? "text-amber-600" : ""
                      )}>
                        {fmt(c.valor)}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* B2B resumo */}
        <div className="rounded-xl border p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">B2B — Faturamento do Mês</p>
            {tinyQ.isLoading ? (
              <Skeleton className="h-7 w-32 mt-1" />
            ) : (
              <p className="text-2xl font-bold tabular-nums mt-0.5" style={{ color: "#7C3AED" }}>
                {fmt(fatB2B)}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">
              {(tinyQ.data ?? []).filter(p => situacoesOk.includes(p.situacao?.toLowerCase() ?? "")).length} pedidos aprovados
            </p>
          </div>
          <button
            onClick={() => navigate("/b2b")}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Ver B2B <ArrowRight size={11} />
          </button>
        </div>

      </div>
    </div>
  );
}
