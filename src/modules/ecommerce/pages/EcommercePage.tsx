import { useQuery } from "@tanstack/react-query";
import {
  ShoppingCart, Package, TrendingUp, Clock, XCircle,
  RefreshCw, Store, CreditCard, Truck, AlertCircle,
} from "lucide-react";
import { fetchNSOverview, parseNSAmount, NuvemshopAuthError, type NSOrder } from "../api/nuvemshop";

// ── Helpers ──────────────────────────────────────────────────────

function fmtBRL(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function statusBadge(order: NSOrder) {
  const s = order.payment_status;
  const map: Record<string, { label: string; cls: string }> = {
    paid:       { label: "Pago",       cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
    pending:    { label: "Aguardando", cls: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
    refunded:   { label: "Reembolsado",cls: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
    voided:     { label: "Cancelado",  cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
    authorized: { label: "Autorizado", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  };
  const { label, cls } = map[s] ?? { label: s, cls: "bg-muted text-muted-foreground" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${cls}`}>
      {label}
    </span>
  );
}

function paymentIcon(method: string | undefined) {
  if (!method) return null;
  if (method.includes("pix")) return <span className="text-[9px] font-bold text-emerald-600">PIX</span>;
  if (method.includes("credit")) return <CreditCard size={11} className="text-blue-500" />;
  if (method.includes("boleto")) return <span className="text-[9px] font-bold text-orange-600">BOL</span>;
  return null;
}

// ── KPI Card ────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, icon: Icon, color = "slate",
}: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; color?: string;
}) {
  const colors: Record<string, string> = {
    emerald: "text-emerald-600 dark:text-emerald-400",
    yellow:  "text-yellow-600 dark:text-yellow-400",
    blue:    "text-blue-600 dark:text-blue-400",
    red:     "text-red-600 dark:text-red-400",
    slate:   "text-slate-600 dark:text-slate-400",
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

// ── Order Card ──────────────────────────────────────────────────

function OrderCard({ order }: { order: NSOrder }) {
  const total = parseNSAmount(order.total);
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-2.5">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-foreground">#{order.number}</span>
            {statusBadge(order)}
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {order.customer?.name ?? "Cliente"}
            {order.shipping_address ? ` · ${order.shipping_address.city}/${order.shipping_address.province}` : ""}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-bold text-foreground">{fmtBRL(total)}</p>
          <p className="text-[10px] text-muted-foreground">{fmtDate(order.created_at)}</p>
        </div>
      </div>

      {/* Products */}
      <div className="space-y-1">
        {order.products.map((p, i) => (
          <div key={i} className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground truncate max-w-[180px]">
              {p.quantity}× {p.name}
            </span>
            <span className="text-foreground font-medium shrink-0">
              {fmtBRL(parseNSAmount(p.price) !== null && Number.isFinite(p.quantity) ? parseNSAmount(p.price)! * p.quantity : null)}
            </span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2 pt-1 border-t border-border">
        {paymentIcon(order.payment_details?.method)}
        {order.payment_details?.installments && order.payment_details.installments > 1 && (
          <span className="text-[10px] text-muted-foreground">
            {order.payment_details.installments}×
          </span>
        )}
        <Truck size={11} className="text-muted-foreground ml-auto" />
        <span className="text-[10px] text-muted-foreground">{fmtBRL(parseNSAmount(order.shipping))}</span>
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────

export default function EcommercePage() {
  const overview = useQuery({
    queryKey: ["ecommerce", "ns-overview"],
    queryFn: fetchNSOverview,
    staleTime: 3 * 60 * 1000,
    retry: 1,
  });
  const data = overview.isError ? undefined : overview.data;
  const stats = data?.stats;
  const recentOrders = data ? [...data.orders].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)).slice(0, 20) : [];
  const authError = overview.error instanceof NuvemshopAuthError;
  const handleRefresh = () => { void overview.refetch(); };

  return (
    <div className="min-h-screen bg-background">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="px-4 md:px-6 pt-6 pb-3 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Store size={16} className="text-muted-foreground" />
            <h1 className="text-base font-semibold text-foreground">Ecommerce</h1>
            <span className="text-[10px] text-muted-foreground bg-muted rounded-full px-2 py-0.5">
              Nuvemshop
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={overview.isFetching}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <RefreshCw size={12} className={overview.isFetching ? "animate-spin" : ""} />
          Atualizar
        </button>
      </div>

      <div className="mx-4 md:mx-6 mb-3 space-y-2 text-xs text-muted-foreground">
        <p>Fonte: Nuvemshop, pedidos retornados pela API. Consulta limitada à página 1, até 200 pedidos. Indicadores desta página não representam o dia, o mês nem toda a loja.</p>
        <p>Consultado: {data ? new Date(data.fetchedAt).toLocaleString("pt-BR") : "indisponível"}. Intervalo de criação recebido: {data?.periodStart && data.periodEnd ? `${fmtDate(data.periodStart)} a ${fmtDate(data.periodEnd)}` : data ? "sem registros" : "indisponível"} (horário local).</p>
        <p>Alteração mais recente entre os pedidos recebidos: {data?.sourceUpdatedAt ? fmtDate(data.sourceUpdatedAt) : "não informada"}. Isso não confirma a atualização de todos os pedidos.</p>
        <p>Receita: soma do total dos pedidos pagos, excluindo cancelados, com frete/descontos conforme a API; não equivale ao repasse líquido.</p>
        {overview.isError && <p role="alert" className="text-red-600">{authError ? "Autenticação da Nuvemshop recusada. Verifique a integração no servidor." : "Não foi possível consultar os pedidos da Nuvemshop. Tente atualizar novamente."} Indicadores indisponíveis.</p>}
      </div>

      {/* ── KPIs ───────────────────────────────────────────── */}
      <div className="px-4 md:px-6 pb-4">
        {overview.isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />
            ))}
          </div>
        ) : stats ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
              <KpiCard
                label="Receita paga · página 1"
                value={fmtBRL(stats.totalRevenue)}
                sub={stats.totalRevenue === null ? "valor ausente em pedido pago" : `${stats.paidOrders} pedidos pagos não cancelados`}
                icon={TrendingUp}
                color="emerald"
              />
              <KpiCard
                label="Pedidos · página 1"
                value={String(stats.totalOrders)}
                sub={`até ${data.pageSize} pedidos recebidos`}
                icon={ShoppingCart}
                color="blue"
              />
              <KpiCard
                label="Ticket Médio"
                value={fmtBRL(stats.avgTicket)}
                sub="pagos não cancelados da página 1"
                icon={CreditCard}
                color="slate"
              />
              <KpiCard
                label="Aguardando · página 1"
                value={String(stats.pendingOrders)}
                sub={`${stats.cancelledOrders} cancelados`}
                icon={stats.pendingOrders > 0 ? AlertCircle : Clock}
                color={stats.pendingOrders > 0 ? "yellow" : "slate"}
              />
            </div>
          </>
        ) : overview.isError ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Receita paga · página 1" value="—" sub="consulta indisponível" icon={TrendingUp} color="slate" />
            <KpiCard label="Pedidos · página 1" value="—" sub="consulta indisponível" icon={ShoppingCart} color="slate" />
            <KpiCard label="Ticket Médio" value="—" sub="consulta indisponível" icon={CreditCard} color="slate" />
            <KpiCard label="Aguardando · página 1" value="—" sub="consulta indisponível" icon={AlertCircle} color="red" />
          </div>
        ) : null}

        {/* ── Pedidos recentes ──────────────────────────── */}
        <div className="mt-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Pedidos da página recebida ({data ? recentOrders.length : "—"} de {data?.orders.length ?? "—"}; até 20 exibidos)
          </p>

          {overview.isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-32 bg-muted animate-pulse rounded-xl" />
              ))}
            </div>
          ) : overview.error ? (
            <div className="flex items-center gap-2 p-4 rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/20 text-xs text-red-700 dark:text-red-400">
              <XCircle size={14} />
              Pedidos indisponíveis. Verifique a conexão ou a integração no servidor e tente novamente.
            </div>
          ) : (
            <div className="space-y-3">
              {recentOrders.length === 0 ? (
                <div className="py-12 text-center">
                  <Package size={28} className="text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhum pedido encontrado</p>
                </div>
              ) : (
                recentOrders.map((order) => (
                  <OrderCard key={order.id} order={order} />
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
