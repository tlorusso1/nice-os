import { useMemo } from "react";
import { Archive, CalendarDays, Database, Landmark, Package, ReceiptText, WalletCards } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFocusModes } from "@/hooks/useFocusModes";
import type { ContaFluxo, CustoFixoItem, Emprestimo, ItemEstoque } from "@/types/focus-mode";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const number = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

function parseMoney(value: string | number | undefined) {
  if (typeof value === "number") return value;
  if (!value) return 0;
  const normalized = value.replace(/\s/g, "").replace(/R\$/gi, "").replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDate(value?: string) {
  if (!value) return "Sem data";
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function SummaryCard({ label, value, icon: Icon }: { label: string; value: number; icon: typeof ReceiptText }) {
  return (
    <div className="metric-card min-w-0">
      <div className="flex items-center justify-between gap-3 text-muted-foreground">
        <span className="text-xs font-medium">{label}</span>
        <Icon size={15} aria-hidden="true" />
      </div>
      <strong className="text-2xl font-semibold">{number.format(value)}</strong>
    </div>
  );
}

function EmptyData() {
  return <p className="py-12 text-center text-sm text-muted-foreground">Nenhum registro encontrado nesta categoria.</p>;
}

function FinancialRow({ item }: { item: ContaFluxo }) {
  const isIncome = item.tipo === "receber" || item.tipo === "resgate";
  return (
    <li className="grid gap-2 border-b border-border py-3 last:border-0 sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="min-w-0">
        <p className="break-words text-sm font-medium">{item.descricao || "Sem descrição"}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{item.dataPagamento ? `Pago em ${formatDate(item.dataPagamento)}` : `Vence em ${formatDate(item.dataVencimento)}`}</span>
          {item.categoria && <span>• {item.categoria}</span>}
          {item.contaOrigem && <span>• {item.contaOrigem}</span>}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 sm:justify-end">
        <Badge variant="outline">{item.pago ? "Realizado" : "Pendente"}</Badge>
        <span className={`whitespace-nowrap text-sm font-semibold ${isIncome ? "text-primary" : "text-destructive"}`}>
          {isIncome ? "+" : "−"}{money.format(Math.abs(parseMoney(item.valor)))}
        </span>
      </div>
    </li>
  );
}

type FixedCost = (CustoFixoItem | Emprestimo) & { category: string };

function FixedCostRow({ item }: { item: FixedCost }) {
  const isLoan = "parcelaMedia" in item;
  const title = isLoan ? `${item.produto} — ${item.banco}` : item.nome;
  const value = isLoan ? item.parcelaMedia : item.valor;
  return (
    <li className="grid gap-2 border-b border-border py-3 last:border-0 sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="min-w-0">
        <p className="break-words text-sm font-medium">{title}</p>
        <p className="mt-1 text-xs capitalize text-muted-foreground">
          {item.category}{isLoan ? ` • ${item.parcelasRestantes} parcelas restantes` : ` • ${item.tipo}`}
        </p>
      </div>
      <span className="text-sm font-semibold">{money.format(value)}</span>
    </li>
  );
}

function InventoryRow({ item }: { item: ItemEstoque }) {
  return (
    <li className="grid gap-2 border-b border-border py-3 last:border-0 sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="min-w-0">
        <p className="break-words text-sm font-medium">{item.nome}</p>
        <p className="mt-1 text-xs capitalize text-muted-foreground">
          {item.tipo.replace("_", " ")}{item.localizacao ? ` • ${item.localizacao}` : ""}
        </p>
      </div>
      <div className="flex items-baseline gap-1 sm:justify-end">
        <span className="text-base font-semibold">{number.format(item.quantidade)}</span>
        <span className="text-xs text-muted-foreground">{item.unidade}</span>
      </div>
    </li>
  );
}

export default function OperacoesPage() {
  const { modes, isLoading } = useFocusModes();
  const financeiro = modes.financeiro.financeiroData;
  const supply = modes.supplychain.supplyChainData;
  const entries = financeiro?.contasFluxo ?? [];
  const inventory = supply?.itens ?? [];
  const movements = supply?.movimentacoes ?? [];
  const fixedCosts = useMemo(() => {
    const groups = financeiro?.custosFixosDetalhados;
    if (!groups) return [];
    return Object.entries(groups).flatMap(([category, items]) =>
      (items ?? []).map((item) => ({ ...item, category }))
    ) as FixedCost[];
  }, [financeiro?.custosFixosDetalhados]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6">
        <Skeleton className="h-24 w-full" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-24" />)}
        </div>
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 lg:py-8">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-primary">
          <Archive size={17} aria-hidden="true" />
          <span className="text-xs font-semibold uppercase tracking-normal">Dados recuperados</span>
        </div>
        <h1 className="text-2xl font-semibold sm:text-3xl">Seus registros continuam salvos</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          Encontrei o histórico consolidado da sua conta. Ele está armazenado com segurança no banco do NICE OS; esta tela apenas apresenta o conteúdo original.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Resumo dos dados encontrados">
        <SummaryCard label="Lançamentos" value={entries.length} icon={ReceiptText} />
        <SummaryCard label="Custos fixos" value={fixedCosts.length} icon={WalletCards} />
        <SummaryCard label="Itens em estoque" value={inventory.length} icon={Package} />
        <SummaryCard label="Movimentações" value={movements.length} icon={Landmark} />
      </section>

      <section className="rounded-lg border border-border bg-card p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Database size={17} aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">Onde estão armazenados</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              No banco do NICE OS, no registro consolidado “Estado dos modos de foco” vinculado à sua conta. Financeiro e Supply Chain estão dentro desse mesmo registro, atualizado por último em 16/07/2026.
            </p>
          </div>
        </div>
      </section>

      <Tabs defaultValue="financeiro" className="w-full">
        <TabsList className="grid h-auto w-full grid-cols-3">
          <TabsTrigger value="financeiro" className="min-h-9 px-2 text-xs sm:text-sm">Financeiro</TabsTrigger>
          <TabsTrigger value="fixos" className="min-h-9 px-2 text-xs sm:text-sm">Custos fixos</TabsTrigger>
          <TabsTrigger value="estoque" className="min-h-9 px-2 text-xs sm:text-sm">Estoque</TabsTrigger>
        </TabsList>

        <TabsContent value="financeiro" className="mt-4 rounded-lg border border-border bg-card px-4 sm:px-5">
          <div className="flex items-center justify-between gap-4 border-b border-border py-4">
            <div>
              <h2 className="font-semibold">Lançamentos financeiros</h2>
              <p className="mt-1 text-xs text-muted-foreground">Contas a pagar, receber e registros conciliados.</p>
            </div>
            <Badge variant="secondary">{entries.length}</Badge>
          </div>
          {entries.length ? <ul>{entries.map((item) => <FinancialRow key={item.id} item={item} />)}</ul> : <EmptyData />}
        </TabsContent>

        <TabsContent value="fixos" className="mt-4 rounded-lg border border-border bg-card px-4 sm:px-5">
          <div className="flex items-center justify-between gap-4 border-b border-border py-4">
            <div>
              <h2 className="font-semibold">Custos fixos detalhados</h2>
              <p className="mt-1 text-xs text-muted-foreground">Pessoas, softwares, marketing, serviços, armazenagem e empréstimos.</p>
            </div>
            <Badge variant="secondary">{fixedCosts.length}</Badge>
          </div>
          {fixedCosts.length ? <ul>{fixedCosts.map((item) => <FixedCostRow key={`${item.category}-${item.id}`} item={item} />)}</ul> : <EmptyData />}
        </TabsContent>

        <TabsContent value="estoque" className="mt-4 rounded-lg border border-border bg-card px-4 sm:px-5">
          <div className="flex items-center justify-between gap-4 border-b border-border py-4">
            <div>
              <h2 className="font-semibold">Itens de estoque</h2>
              <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><CalendarDays size={12} /> Quantidades preservadas no último salvamento.</p>
            </div>
            <Badge variant="secondary">{inventory.length}</Badge>
          </div>
          {inventory.length ? <ul>{inventory.map((item) => <InventoryRow key={item.id} item={item} />)}</ul> : <EmptyData />}
        </TabsContent>
      </Tabs>
    </div>
  );
}
