import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, AlertTriangle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useAsaasBalance, useAsaasReceivables, useAsaasOverdue, useTinyPedidosMes } from '@/modules/financeiro/hooks/useFinanceiroData';
import { getBlingContasPagar } from '@/modules/financeiro/api/bling';
import { useNavigate } from 'react-router-dom';
import { monthKey, percentageChange, sumKnown, syncFailedSources } from '@/lib/dataIntegrity';

const fmt = (value: number | null) => value === null ? 'Indisponível' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
const dateTime = (value: number | string) => value ? new Date(value).toLocaleString('pt-BR') : 'não confirmada';
const nameMonth = (month: string) => new Date(`${month}-01T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
const CHANNELS: Record<string, string> = { nuvemshop: 'Nuvemshop', shopee: 'Shopee', ritz_pay: 'Ritz Pay', nice_sp: 'Nice SP', b2b: 'B2B', b2b_tiny: 'B2B (legado)' };
const APPROVED = ['aprovado', 'preparando envio', 'pronto para envio', 'faturado', 'enviado', 'entregue'];

type QueryState = { isLoading: boolean; isError: boolean; dataUpdatedAt: number };
function Provenance({ source, period, query, note }: { source: string; period: string; query: QueryState; note?: string }) {
  return <div className="text-xs text-muted-foreground space-y-0.5 mt-2">
    <p>Fonte: {source}</p><p>Período: {period}</p>
    <p>{query.isError ? 'Consulta falhou; valor não confirmado' : `Consulta: ${dateTime(query.dataUpdatedAt)}`}</p>
    {note && <p>{note}</p>}
  </div>;
}
function Card({ title, value, query, children }: { title: string; value: number | null; query: QueryState; children?: ReactNode }) {
  return <div className="rounded-xl border p-4 bg-card">
    <h2 className="text-xs text-muted-foreground font-medium uppercase">{title}</h2>
    {query.isLoading ? <Skeleton className="h-7 w-32 mt-2" /> : <p className="text-xl font-bold tabular-nums mt-1">{fmt(query.isError ? null : value)}</p>}
    {children}
  </div>;
}
function EmptyOrError({ error, empty }: { error: boolean; empty: string }) {
  return <p role={error ? 'alert' : undefined} className="text-sm text-muted-foreground py-4">{error ? 'Consulta indisponível. Não é possível confirmar os lançamentos.' : empty}</p>;
}

export default function DashboardPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [syncing, setSyncing] = useState(false);
  const currentMonth = monthKey();
  const previousMonth = monthKey(-1);
  const sales = useQuery({
    queryKey: ['vendas_canais', 'dashboard', currentMonth, previousMonth],
    queryFn: async () => {
      const { data, error } = await supabase.from('vendas_canais').select('mes, canal, faturamento, fonte, updated_at').in('mes', [`${currentMonth}-01`, `${previousMonth}-01`]);
      if (error) throw error;
      return data ?? [];
    }, staleTime: 300_000, retry: 1,
  });
  const balance = useAsaasBalance();
  const receivables = useAsaasReceivables();
  const overdue = useAsaasOverdue();
  const tiny = useTinyPedidosMes();
  const payable = useQuery({ queryKey: ['bling', 'contas-pagar', 'dashboard'], queryFn: getBlingContasPagar, staleTime: 300_000, retry: 1 });

  const synchronize = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-vendas', { body: { mode: 'month' } });
      if (error) throw error;
      const failed = syncFailedSources(data);
      await qc.invalidateQueries({ queryKey: ['vendas_canais'] });
      if (failed.length) toast.warning(`Sincronização incompleta: ${failed.join(', ')}. Confira as fontes antes de usar os totais.`);
      else toast.success('Vendas sincronizadas nas fontes consultadas');
    } catch { toast.error('Falha ao sincronizar vendas. Nenhum sucesso foi confirmado.'); }
    finally { setSyncing(false); }
  };

  const currentRows = (sales.data ?? []).filter(row => row.mes.slice(0, 7) === currentMonth);
  const previousRows = (sales.data ?? []).filter(row => row.mes.slice(0, 7) === previousMonth);
  const total = currentRows.length ? sumKnown(currentRows.map(row => row.faturamento)) : null;
  const previous = previousRows.length ? sumKnown(previousRows.map(row => row.faturamento)) : null;
  const delta = percentageChange(total, previous);
  const channels = [...new Set([...Object.keys(CHANNELS).filter(key => key !== 'b2b_tiny'), ...currentRows.map(row => row.canal), ...previousRows.map(row => row.canal)])];
  const approved = (tiny.data ?? []).filter(order => APPROVED.includes(order.situacao?.toLowerCase() ?? ''));
  const overdueRows = overdue.isError ? [] : [...(overdue.data?.data ?? [])].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const payableRows = payable.isError ? [] : [...(payable.data?.data ?? [])].sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  const sampleNote = (data?: { data: unknown[]; totalCount: number }) => data && data.totalCount > data.data.length ? `Parcial: ${data.data.length} de ${data.totalCount} cobranças; total abaixo cobre só a página recebida.` : 'Cobranças retornadas pela integração.';

  return <div className="animate-fade-in px-4 md:px-6 pt-4 md:pt-6 pb-10 space-y-5">
    <div className="flex items-start justify-between gap-3 flex-wrap">
      <div><h1 className="text-lg font-semibold">Visão Geral</h1><p className="text-xs text-muted-foreground">{nameMonth(currentMonth)} · mês em andamento</p></div>
      <div className="flex gap-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={synchronize} disabled={syncing}><RefreshCw size={13} className={syncing ? 'animate-spin mr-1' : 'mr-1'} />Sincronizar vendas</Button>
        <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries()}><RefreshCw size={13} className="mr-1" />Atualizar</Button>
      </div>
    </div>
    <div role="note" className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-3 text-sm">
      <AlertTriangle size={15} className="inline mr-2" />CNPJ não identificado pelas integrações atuais. Estes números não formam um caixa consolidado nem uma conciliação por empresa. Ausência de registro ou falha de conexão não significa zero.
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <Card title="Faturamento registrado" value={total} query={sales}>
        <Provenance source="vendas_canais (registros sincronizados/importados)" period={nameMonth(currentMonth)} query={sales} note="Cobertura e conciliação entre fontes ainda não verificadas." />
        <p className="text-xs mt-2">{delta === null || sales.isError ? 'Sem base válida para variação percentual' : `${delta > 0 ? '+' : ''}${delta.toFixed(1)}% versus mês anterior completo`}</p>
      </Card>
      <Card title="Saldo disponível Asaas" value={balance.data?.balance ?? null} query={balance}><Provenance source="Asaas" period="posição consultada, sem outros bancos" query={balance} /></Card>
      <Card title="A receber · página consultada" value={receivables.data ? sumKnown(receivables.data.data.map(row => row.value)) : null} query={receivables}><Provenance source="Asaas" period="pendentes e vencidas, sem filtro mensal" query={receivables} note={sampleNote(receivables.data)} /></Card>
      <Card title="Vencidas · página consultada" value={overdue.data ? sumKnown(overdue.data.data.map(row => row.value)) : null} query={overdue}><Provenance source="Asaas" period="cobranças vencidas, sem filtro mensal" query={overdue} note={sampleNote(overdue.data)} /></Card>
    </div>
    <section>
      <div className="flex justify-between mb-2"><h2 className="text-sm font-semibold">Faturamento por canal</h2><Button variant="ghost" size="sm" onClick={() => navigate('/canais')}>Ver detalhes <ArrowRight size={12} /></Button></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{channels.map(channel => {
        const rows = currentRows.filter(row => row.canal === channel);
        const sources = [...new Set(rows.map(row => row.fonte || 'origem não informada'))].join(', ');
        const latest = rows.reduce((value, row) => row.updated_at > value ? row.updated_at : value, '');
        return <Card key={channel} title={CHANNELS[channel] ?? channel} value={rows.length ? sumKnown(rows.map(row => row.faturamento)) : null} query={sales}>
          <Provenance source={sources || 'sem registro no período'} period={nameMonth(currentMonth)} query={sales} note={latest ? `Registro atualizado em ${dateTime(latest)}; data de sincronização não garante conciliação.` : 'Cobertura não confirmada.'} />
        </Card>;
      })}</div>
    </section>
    <div className="grid md:grid-cols-2 gap-4">
      <section className="rounded-xl border p-4"><h2 className="text-sm font-semibold">Cobranças vencidas · Asaas</h2>
        <Provenance source="Asaas" period="vencidas, sem filtro mensal" query={overdue} note={sampleNote(overdue.data)} />
        {overdue.isLoading ? <Skeleton className="h-20 mt-3" /> : overdue.isError || !overdueRows.length ? <EmptyOrError error={overdue.isError} empty="A consulta retornou zero cobranças vencidas." /> : overdueRows.slice(0, 6).map(row => <div key={row.id} className="flex justify-between gap-2 border-b py-2 text-sm"><span className="min-w-0 truncate">{row.description || 'Cobrança'}<small className="block text-muted-foreground">Vencimento: {row.dueDate}</small></span><span>{fmt(row.value)}</span></div>)}
        {!overdue.isError && overdueRows.length > 0 && <p className="text-xs mt-2">Mostrando {Math.min(6, overdueRows.length)} de {overdueRows.length} registros recebidos.</p>}
      </section>
      <section className="rounded-xl border p-4"><h2 className="text-sm font-semibold">A pagar · Bling · primeira página</h2>
        <p className="font-semibold mt-2">{payable.isLoading ? 'Carregando…' : fmt(payable.isError || !payable.data ? null : sumKnown(payable.data.data.map(row => row.valor)))}</p>
        <Provenance source="Bling" period="contas em aberto, todos os vencimentos" query={payable} note="Até 100 registros; total parcial enquanto a paginação não for conciliada." />
        {payable.isLoading ? <Skeleton className="h-20 mt-3" /> : payable.isError || !payableRows.length ? <EmptyOrError error={payable.isError} empty="A consulta retornou zero contas em aberto." /> : payableRows.slice(0, 6).map(row => <div key={row.id} className="flex justify-between gap-2 border-b py-2 text-sm"><span className="min-w-0 truncate">{row.fornecedor?.nome || row.historico || 'Fornecedor'}<small className="block text-muted-foreground">Vencimento: {row.vencimento}</small></span><span>{fmt(row.valor)}</span></div>)}
      </section>
    </div>
    <Card title="B2B · pedidos aprovados consultados" value={tiny.data ? sumKnown(approved.map(order => order.valor)) : null} query={tiny}>
      <Provenance source="Tiny" period={nameMonth(currentMonth)} query={tiny} note="Primeira página de pedidos; não somar novamente ao faturamento por canal. Pedido aprovado não é saldo recebido." />
      {!tiny.isError && tiny.data && <p className="text-xs mt-2">{approved.length} pedidos aprovados na página recebida</p>}
    </Card>
    <div className="rounded-xl border p-4 text-sm space-y-2"><h2 className="font-semibold">Cobertura do painel</h2><p className="text-muted-foreground">Estoque, anúncios, social e e-mail têm módulos próprios. Conversão de venda por canal e CNPJ ainda depende de vínculo verificado entre pedido, recebimento, fonte de aquisição e empresa. Não há taxa consolidada confiável disponível nesta tela.</p><div className="flex gap-2 flex-wrap"><Button variant="outline" size="sm" onClick={() => navigate('/supply')}>Estoque</Button><Button variant="outline" size="sm" onClick={() => navigate('/marketing')}>Ads, social e e-mail</Button><Button variant="outline" size="sm" onClick={() => navigate('/financeiro')}>Financeiro</Button></div></div>
  </div>;
}
