import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Package, AlertTriangle, XCircle, ArrowRightLeft,
  RefreshCw, ExternalLink, Info, Search,
} from "lucide-react";
import { fetchEstoqueSnapshot, calcEstoqueStats, type SKUEstoque } from "../api/estoque";

// ── Helpers ──────────────────────────────────────────────────────

type Filter = "todos" | "ruptura" | "baixo" | "divergente" | "indisponivel";

const STATUS_CONFIG: Record<SKUEstoque["status"], { label: string; cls: string }> = {
  indisponivel: { label: "Saldo indisponível", cls: "bg-muted text-muted-foreground" },
  ok:         { label: "Saldo ERP normal",         cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  baixo:      { label: "Baixo",      cls: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  ruptura:    { label: "Ruptura",    cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  divergente: { label: "Divergente", cls: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
};

function StatusBadge({ status }: { status: SKUEstoque["status"] }) {
  const { label, cls } = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${cls}`}>
      {label}
    </span>
  );
}

// ── KPI Card ─────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, icon: Icon, color = "slate",
}: { label: string; value: string; sub?: string; icon: React.ElementType; color?: string }) {
  const colors: Record<string, string> = {
    emerald: "text-emerald-600 dark:text-emerald-400",
    yellow:  "text-yellow-600 dark:text-yellow-400",
    red:     "text-red-600 dark:text-red-400",
    orange:  "text-orange-600 dark:text-orange-400",
    slate:   "text-foreground",
  };
  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground font-medium">{label}</span>
        <Icon size={14} className={colors[color] ?? colors.slate} />
      </div>
      <p className={`text-xl font-bold ${colors[color] ?? colors.slate}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

// ── SKU Row ───────────────────────────────────────────────────────

function SkuRow({ sku }: { sku: SKUEstoque }) {

  return (
    <tr className="border-b border-border hover:bg-muted/30 transition-colors">
      <td className="px-3 py-3">
        <p className="text-[12px] font-medium text-foreground">{sku.nome}</p>
        <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{sku.sku}</p>
      </td>
      <td className="px-3 py-3 text-center">
        <span className={`text-sm font-bold ${
          sku.estoqueErp === 0 ? "text-red-500"
            : sku.estoqueErp !== null && sku.estoqueErp <= 10 ? "text-yellow-500"
            : "text-foreground"
        }`}>
          {sku.estoqueErp ?? "—"}
        </span>
      </td>
      <td className="px-3 py-3 text-center text-sm text-muted-foreground">
        {sku.estoqueNuvemshop ?? <span className="text-[10px] italic text-muted-foreground/40">—</span>}
      </td>
      <td className="px-3 py-3 text-center text-[10px] text-muted-foreground/40 italic hidden lg:table-cell">em breve</td>
      <td className="px-3 py-3 text-center text-[10px] text-muted-foreground/40 italic hidden lg:table-cell">em breve</td>
      <td className="px-3 py-3 text-center">
        {sku.divergencia !== null ? (
          <span className="text-[11px] font-medium text-orange-500">
            {sku.divergencia! > 0 ? "+" : ""}{sku.divergencia}
          </span>
        ) : (
          <span className="text-[10px] text-muted-foreground/40">—</span>
        )}
      </td>
      <td className="px-3 py-3 text-center">
        <StatusBadge status={sku.status} />
      </td>
      <td className="px-3 py-3 text-right">
        {sku.urlTiny ? (
          <a
            href={sku.urlTiny}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <ExternalLink size={11} />
            Tiny
          </a>
        ) : null}
      </td>
    </tr>
  );
}

// ── Main Page ─────────────────────────────────────────────────────

export default function SupplyPage() {
  const [filter, setFilter] = useState<Filter>("todos");
  const [search, setSearch] = useState("");

  const skus = useQuery({
    queryKey: ["supply", "snapshot"],
    queryFn: fetchEstoqueSnapshot,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  // Totais e tabela são derivados da mesma consulta.
  const data = skus.isError ? undefined : skus.data;
  const stats = data ? calcEstoqueStats(data.items) : undefined;

  const filtered = (data?.items ?? []).filter((s) => {
    if (filter === "ruptura" && (s.estoqueErp === null || s.estoqueErp > 0)) return false;
    if (filter === "baixo" && (s.estoqueErp === null || s.estoqueErp <= 0 || s.estoqueErp > 10)) return false;
    if (filter === "divergente" && (s.divergencia === null || s.divergencia === 0)) return false;
    if (filter === "indisponivel" && s.estoqueErp !== null) return false;
    if (search) {
      const q = search.toLowerCase();
      return s.nome.toLowerCase().includes(q) || s.sku.toLowerCase().includes(q);
    }
    return true;
  });

  const handleRefresh = () => {
    skus.refetch();
  };

  const FILTERS: { id: Filter; label: string }[] = [
    { id: "todos",      label: `Todos (${data?.items.length ?? "—"})` },
    { id: "ruptura",    label: `Ruptura (${stats?.skusRuptura ?? "—"})` },
    { id: "baixo",      label: `Baixo (${stats?.skusBaixo ?? "—"})` },
    { id: "indisponivel", label: "Saldo indisponível" },
    { id: "divergente", label: `Divergência (${stats?.skusDivergente ?? "—"})` },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="px-4 md:px-6 pt-6 pb-3 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Package size={16} className="text-muted-foreground" />
            <h1 className="text-base font-semibold text-foreground">Estoque</h1>
            <span className="text-[10px] text-muted-foreground bg-muted rounded-full px-2 py-0.5">
              Tiny + Nuvemshop
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={skus.isFetching}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <RefreshCw size={12} className={skus.isFetching ? "animate-spin" : ""} />
          Atualizar
        </button>
      </div>

      <div className="mx-4 md:mx-6 mb-3 space-y-2 text-xs text-muted-foreground">
        <p>Fonte: Tiny (cadastro/saldo ERP) e Nuvemshop (saldo publicado). Período: posição recebida na consulta; não é histórico.</p>
        <p>Consultado (horário local): Tiny {data ? new Date(data.fetchedAt).toLocaleString("pt-BR") : "indisponível"}; Nuvemshop {data?.nuvemshop.fetchedAt ? new Date(data.nuvemshop.fetchedAt).toLocaleString("pt-BR") : "indisponível"}. Horário da última movimentação: não informado pelas fontes.</p>
        {data?.warnings.map((warning) => <p key={warning} className="flex gap-2"><Info size={13} className="shrink-0 mt-0.5" />{warning}</p>)}
        {data && !data.nuvemshop.available && <p role="alert" className="text-amber-700">Nuvemshop indisponível: {data.nuvemshop.error} A comparação de estoque está indisponível.</p>}
        {skus.isError && <p role="alert" className="text-red-600">Não foi possível consultar o estoque. {skus.error instanceof Error ? skus.error.message : "Tente atualizar novamente."} Nenhum indicador foi substituído por zero.</p>}
      </div>

      <div className="px-4 md:px-6 pb-8 space-y-4">
        {/* KPIs */}
        {skus.isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />)}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="SKUs recebidos"      value={String(stats.totalSkus)}      sub="página consultada do ERP"    icon={Package}       color="slate" />
            <KpiCard label="Em Ruptura"      value={String(stats.skusRuptura ?? "—")}    sub={`${stats.saldosConhecidos} saldos conhecidos; ≤ 0`}     icon={XCircle}       color="red" />
            <KpiCard label="Estoque Baixo"   value={String(stats.skusBaixo ?? "—")}      sub={`${stats.saldosConhecidos} saldos conhecidos; 1 a 10`}    icon={AlertTriangle} color="yellow" />
            <KpiCard label="Com Divergência" value={String(stats.skusDivergente ?? "—")} sub={`${stats.skusComparados} SKUs comparáveis`} icon={ArrowRightLeft} color="orange" />
          </div>
        ) : null}

        {/* Filters + Search */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex items-center gap-1 flex-wrap">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                  filter === f.id
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="relative sm:ml-auto">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar SKU ou nome..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-[12px] bg-muted border border-border rounded-lg outline-none focus:ring-1 focus:ring-ring w-full sm:w-52"
            />
          </div>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {skus.isLoading ? (
            <div className="space-y-0">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-14 bg-muted/40 animate-pulse border-b border-border last:border-0" />
              ))}
            </div>
          ) : skus.isError ? (
            <p className="p-8 text-center text-sm text-muted-foreground">Estoque indisponível. Use Atualizar para tentar novamente.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Produto / SKU</th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Tiny</th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Nuvemshop</th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Mercado Livre</th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Shopee</th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Dif.</th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Link</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center">
                        <Package size={24} className="mx-auto text-muted-foreground/30 mb-2" />
                        <p className="text-sm text-muted-foreground">Nenhum produto encontrado</p>
                      </td>
                    </tr>
                  ) : (
                    filtered.map((sku) => <SkuRow key={sku.id} sku={sku} />)
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {filtered.length > 0 && (
          <p className="text-[10px] text-muted-foreground text-center">
            {filtered.length} produto{filtered.length !== 1 ? "s" : ""} · Saldos somente quando informados pela fonte · ML e Shopee em breve
          </p>
        )}
      </div>
    </div>
  );
}
