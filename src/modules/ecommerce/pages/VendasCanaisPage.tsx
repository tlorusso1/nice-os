import { useState, useMemo, Fragment } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { readAllSalesRows, requireSalesNumbers } from '../api/vendasCanais'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend, CartesianGrid
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue
} from '@/components/ui/select'
import { Package, Download, ChevronRight } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface VendasRow {
  id: string
  fonte: string | null
  atualizado_em: string | null
  mes: string
  canal: string
  pedidos: number
  faturamento: number
}

interface ProdutoRow {
  id: string
  atualizado_em: string | null
  mes: string
  canal: string
  nome: string
  sku: string | null
  qtd_vendida: number
  faturamento: number
}

// ─── Config ───────────────────────────────────────────────────────────────────

const CANAL_CONFIG: Record<string, { label: string; color: string }> = {
  nuvemshop: { label: 'Nuvemshop', color: '#2B7FFF' },
  shopee:    { label: 'Shopee BR', color: '#FF6B00' },
  ritz_pay:  { label: 'Ritz Pay',  color: '#E8A838' },
  nice_sp:   { label: 'NICE SP',   color: '#4DC98A' },
  b2b_tiny:  { label: 'B2B',       color: '#7C3AED' },
}

const CANAL_ORDER = ['nuvemshop', 'shopee', 'ritz_pay', 'nice_sp', 'b2b_tiny']

// ─── Date helpers ─────────────────────────────────────────────────────────────

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function subMonths(d: Date, n: number): Date {
  const r = startOfMonth(d)
  r.setMonth(r.getMonth() - n)
  return startOfMonth(r)
}

function fmtIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function fmtMes(dateStr: string): string {
  const parts = dateStr.split('-')
  const year  = parts[0]
  const month = parseInt(parts[1], 10)
  const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  return `${MONTHS[month - 1]}/${year.slice(2)}`
}

function fmtBRL(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return "—"
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 })
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// ─── Periods ──────────────────────────────────────────────────────────────────

function getPeriodRange(key: string): { start: string; end: string } {
  const now = new Date()
  if (/^\d{4}$/.test(key)) return { start: `${key}-01-01`, end: `${key}-12-01` }
  switch (key) {
    case 'atual':
      return { start: `${now.getFullYear()}-01-01`, end: fmtIso(now) }
    case '6m':
      return { start: fmtIso(subMonths(now, 5)), end: fmtIso(now) }
    case '12m':
      return { start: fmtIso(subMonths(now, 11)), end: fmtIso(now) }
    case 'tudo':
      return { start: '2000-01-01', end: '2099-12-01' }
    default:
      return { start: `${now.getFullYear()}-01-01`, end: fmtIso(now) }
  }
}

const PERIOD_OPTIONS = [
  ...Array.from({ length: Math.max(0, new Date().getFullYear() - 2023) }, (_, i) => ({ key: String(2023 + i), label: String(2023 + i) })),
  { key: 'atual', label: 'Ano atual' },
  { key: '6m', label: 'Últimos 6m' },
  { key: '12m', label: 'Últimos 12m' },
  { key: 'tudo', label: 'Tudo' },
]

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, label, metrica }: any) {
  if (!active || !payload?.length) return null
  const total = payload.reduce((s: number, e: { value: number }) => s + (e.value || 0), 0)
  return (
    <div className="bg-background border rounded-lg p-3 shadow-lg text-sm min-w-40">
      <p className="font-semibold mb-2">{label}</p>
      {payload.map((entry: { dataKey: string; value: number; color: string }) => (
        <div key={entry.dataKey} className="flex justify-between gap-4 py-0.5">
          <span style={{ color: entry.color }}>
            {CANAL_CONFIG[entry.dataKey]?.label ?? entry.dataKey}
          </span>
          <span className="font-mono tabular-nums">
            {metrica === 'faturamento'
              ? fmtBRL(entry.value)
              : entry.value.toLocaleString('pt-BR')}
          </span>
        </div>
      ))}
      <div className="border-t mt-2 pt-1 flex justify-between font-semibold">
        <span className="text-muted-foreground">Total</span>
        <span className="font-mono tabular-nums">
          {metrica === 'faturamento' ? fmtBRL(total) : total.toLocaleString('pt-BR')}
        </span>
      </div>
    </div>
  )
}

// ─── CSV Export ───────────────────────────────────────────────────────────────

function downloadCSV(rows: string[][], filename: string) {
  const csv = rows.map(r => r.map(c => {
    const s = String(c ?? '')
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }).join(';')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  window.URL.revokeObjectURL(url)
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VendasCanaisPage() {
  const [period, setPeriod]   = useState<string>('atual')
  const [canal, setCanal]     = useState<string>('todos')
  const [metrica, setMetrica] = useState<'faturamento' | 'pedidos'>('faturamento')
  const [tableView, setTableView] = useState<'somado' | 'canal'>('somado')
  const [expandedMes, setExpandedMes] = useState<string | null>(null)

  const { start, end } = getPeriodRange(period)

  const vendas = useQuery({
    queryKey: ['vendas-canais', start, end],
    queryFn: async () => requireSalesNumbers(await readAllSalesRows<VendasRow>((from, to) => supabase
      .from('vendas_canais')
      .select('id, mes, canal, pedidos, faturamento, fonte, atualizado_em', { count: 'exact' })
      .gte('mes', start).lte('mes', end)
      .order('mes', { ascending: true }).order('id', { ascending: true }).range(from, to)), ['pedidos', 'faturamento']),
    retry: 1,
  })
  const vendasData = vendas.isError ? undefined : vendas.data
  const vendasLoading = vendas.isLoading

  const produtos = useQuery({
    queryKey: ['vendas-produtos', start, end, canal],
    queryFn: async () => requireSalesNumbers(await readAllSalesRows<ProdutoRow>((from, to) => {
      let q = supabase.from('vendas_produtos')
        .select('id, mes, canal, nome, sku, qtd_vendida, faturamento, atualizado_em', { count: 'exact' })
        .eq('fonte', 'nf').gte('mes', start).lte('mes', end)
        .order('id', { ascending: true }).range(from, to)
      if (canal !== 'todos') q = q.eq('canal', canal)
      return q
    }), ['qtd_vendida', 'faturamento']),
    retry: 1,
  })
  const produtosData = produtos.isError ? undefined : produtos.data
  const produtosLoading = produtos.isLoading

  const drill = useQuery({
    queryKey: ['vendas-produtos-mes', expandedMes, canal],
    enabled: !!expandedMes,
    queryFn: async () => requireSalesNumbers(await readAllSalesRows<ProdutoRow>((from, to) => {
      let q = supabase.from('vendas_produtos')
        .select('id, mes, nome, sku, canal, qtd_vendida, faturamento, atualizado_em', { count: 'exact' })
        .eq('fonte', 'nf').eq('mes', expandedMes!)
        .order('id', { ascending: true }).range(from, to)
      if (canal !== 'todos') q = q.eq('canal', canal)
      return q
    }), ['qtd_vendida', 'faturamento']),
    retry: 1,
  })
  const drillProdutos = drill.isError ? undefined : drill.data
  const drillLoading = drill.isLoading

  const canaisAtivos = useMemo(() => {
    if (!vendasData) return []
    const set = new Set(vendasData.map(r => r.canal))
    return [...CANAL_ORDER.filter(c => set.has(c)), ...[...set].filter(c => !CANAL_ORDER.includes(c)).sort()]
  }, [vendasData])

  const filteredVendas = useMemo(() => {
    if (!vendasData) return []
    return canal === 'todos' ? vendasData : vendasData.filter(r => r.canal === canal)
  }, [vendasData, canal])

  const hasVendas = !vendas.isError && filteredVendas.length > 0
  const sourceDates = filteredVendas.map(r => r.atualizado_em).filter((value): value is string => !!value && Number.isFinite(Date.parse(value))).sort()
  const sourceNames = [...new Set(filteredVendas.map(r => r.fonte ?? 'não informada'))].join(', ')
  const sourceDatesIncomplete = sourceDates.length < filteredVendas.length

  const canaisDisplay = canal === 'todos'
    ? canaisAtivos
    : [canal].filter(c => canaisAtivos.includes(c))

  const chartData = useMemo(() => {
    const byMes: Record<string, Record<string, number>> = {}
    for (const row of filteredVendas) {
      if (!byMes[row.mes]) byMes[row.mes] = {}
      byMes[row.mes][row.canal] = (byMes[row.mes][row.canal] ?? 0) +
        (metrica === 'faturamento' ? Number(row.faturamento) : row.pedidos)
    }
    return Object.entries(byMes)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mes, vals]) => ({ mes: fmtMes(mes), ...vals }))
  }, [filteredVendas, metrica])

  const kpis = useMemo(() => {
    const total    = filteredVendas.reduce((s, r) => s + Number(r.faturamento), 0)
    const totalPed = filteredVendas.reduce((s, r) => s + r.pedidos, 0)
    const byCanal: Record<string, { fat: number; ped: number }> = {}
    for (const r of filteredVendas) {
      if (!byCanal[r.canal]) byCanal[r.canal] = { fat: 0, ped: 0 }
      byCanal[r.canal].fat += Number(r.faturamento)
      byCanal[r.canal].ped += r.pedidos
    }
    return { total, totalPed, byCanal }
  }, [filteredVendas])

  const tabelaMeses = useMemo(() => {
    const byMes: Record<string, Record<string, { fat: number; ped: number }>> = {}
    for (const r of filteredVendas) {
      if (!byMes[r.mes]) byMes[r.mes] = {}
      if (!byMes[r.mes][r.canal]) byMes[r.mes][r.canal] = { fat: 0, ped: 0 }
      byMes[r.mes][r.canal].fat += Number(r.faturamento)
      byMes[r.mes][r.canal].ped += r.pedidos
    }
    return Object.entries(byMes)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([mes, canais]) => ({
        mes,
        canais,
        totalFat: Object.values(canais).reduce((s, c) => s + c.fat, 0),
        totalPed: Object.values(canais).reduce((s, c) => s + c.ped, 0),
      }))
  }, [filteredVendas])

  const totaisTabela = useMemo(() => {
    const fat = tabelaMeses.reduce((s, r) => s + r.totalFat, 0)
    const ped = tabelaMeses.reduce((s, r) => s + r.totalPed, 0)
    return { fat, ped, ticket: ped > 0 ? fat / ped : null }
  }, [tabelaMeses])

  const produtosAgg = useMemo(() => {
    if (!produtosData) return []
    const map: Record<string, { nome: string; sku: string | null; qtd: number; fat: number }> = {}
    for (const r of produtosData) {
      const key = r.sku ? `sku:${r.sku}` : `nome:${r.nome}`
      if (!map[key]) map[key] = { nome: r.nome, sku: r.sku, qtd: 0, fat: 0 }
      map[key].qtd += r.qtd_vendida
      map[key].fat += Number(r.faturamento)
    }
    return Object.values(map).sort((a, b) => b.fat - a.fat)
  }, [produtosData])

  const produtosTotal = produtosAgg.reduce((s, p) => s + p.fat, 0)
  const productSourceDates = (produtosData ?? []).map(row => row.atualizado_em).filter((value): value is string => !!value && Number.isFinite(Date.parse(value))).sort()

  const handleExport = () => {
    if (!hasVendas || vendas.isFetching) return
    const now = new Date()
    const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
    if (tableView === 'somado') {
      const rows: string[][] = [['Mês', 'Pedidos', 'Faturamento', 'Ticket médio']]
      for (const r of tabelaMeses) {
        const ticket = r.totalPed > 0 ? r.totalFat / r.totalPed : null
        rows.push([fmtMes(r.mes), String(r.totalPed), r.totalFat.toFixed(2), ticket === null ? "" : ticket.toFixed(2)])
      }
      downloadCSV(rows, `vendas-canais-${stamp}.csv`)
    } else {
      const rows: string[][] = [['Mês', ...canaisDisplay.map(c => (CANAL_CONFIG[c]?.label ?? c)), 'Total']]
      for (const r of tabelaMeses) {
        rows.push([
          fmtMes(r.mes),
          ...canaisDisplay.map(c => {
            const d = r.canais[c]
            if (!d) return ''
            return (metrica === 'faturamento' ? d.fat : d.ped).toFixed(2)
          }),
          (metrica === 'faturamento' ? r.totalFat : r.totalPed).toFixed(2),
        ])
      }
      downloadCSV(rows, `vendas-canais-${stamp}.csv`)
    }
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Vendas por Canal</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Faturamento e pedidos por canal de venda
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Fonte: vendas_canais no Supabase; origens registradas: {sourceNames || 'indisponíveis'}.
          Período: {period === 'tudo' ? 'todo o histórico disponível' : `${fmtMes(start)} a ${fmtMes(end)}`} (mês atual pode estar incompleto).
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Consultado: {vendas.dataUpdatedAt && !vendas.isError ? fmtDateTime(new Date(vendas.dataUpdatedAt).toISOString()) : 'indisponível'}.
          Atualização dos registros selecionados: {sourceDates.length ? `${fmtDateTime(sourceDates[0])} a ${fmtDateTime(sourceDates[sourceDates.length - 1])}` : 'não informada'}{sourceDatesIncomplete ? '; há registros sem horário válido' : ''}.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Totais somam apenas registros disponíveis. Meses ou canais ausentes não significam venda zero; a consulta não comprova que a sincronização das fontes esteja completa.
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center">
        <ToggleGroup
          type="single"
          value={period}
          onValueChange={(v) => { if (v) { setPeriod(v); setExpandedMes(null) } }}
          variant="outline"
          size="sm"
        >
          {PERIOD_OPTIONS.map(({ key, label }) => (
            <ToggleGroupItem key={key} value={key} className="text-xs px-3">
              {label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <Select value={canal} onValueChange={(value) => { setCanal(value); setExpandedMes(null) }}>
          <SelectTrigger className="w-44 h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os canais</SelectItem>
            {[...new Set([...CANAL_ORDER, ...canaisAtivos])].map(c => (
              <SelectItem key={c} value={c}>{(CANAL_CONFIG[c]?.label ?? c)}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex rounded-md border overflow-hidden divide-x text-sm">
          {(['faturamento', 'pedidos'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMetrica(m)}
              className={`px-3 py-1.5 font-medium transition-colors ${
                metrica === m
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background hover:bg-muted'
              }`}
            >
              {m === 'faturamento' ? 'Faturamento' : 'Pedidos'}
            </button>
          ))}
        </div>
      </div>

      {vendas.isError && <p role="alert" className="text-sm text-red-600">Falha ao consultar vendas. {vendas.error instanceof Error ? vendas.error.message : 'Tente novamente.'} Os indicadores estão indisponíveis.</p>}
      <Button variant="outline" size="sm" disabled={vendas.isFetching || produtos.isFetching || drill.isFetching} onClick={() => { void vendas.refetch(); void produtos.refetch(); if (expandedMes) void drill.refetch() }}>Atualizar</Button>

      {/* KPI cards */}
      {vendasLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="pt-4 pb-3 px-4 space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-3 w-20" />
            </CardContent></Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Card className="col-span-1">
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">
                Total registrado
              </p>
              <p className="text-xl font-semibold mt-1 tabular-nums">{hasVendas ? fmtBRL(kpis.total) : "—"}</p>
              <p className="text-xs text-muted-foreground tabular-nums">
                {hasVendas ? `${kpis.totalPed.toLocaleString('pt-BR')} pedidos` : vendas.isError ? 'Consulta indisponível' : 'Sem registros no período/canal'}
              </p>
            </CardContent>
          </Card>

          {canaisDisplay.map(c => {
            const cfg = CANAL_CONFIG[c] ?? { label: c, color: "#64748B" }
            const d   = kpis.byCanal[c]
            if (!d) return null
            const pct = kpis.total > 0 ? ((d.fat / kpis.total) * 100).toFixed(0) : '0'
            return (
              <Card key={c}>
                <CardContent className="pt-4 pb-3 px-4">
                  <p className="text-[10px] uppercase tracking-widest font-medium" style={{ color: cfg.color }}>
                    {cfg.label}
                  </p>
                  <p className="text-lg font-semibold mt-1 tabular-nums">{fmtBRL(d.fat)}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {`${d.ped.toLocaleString('pt-BR')} ped.`}{' '}
                    <span className="opacity-60">{kpis.total > 0 ? `${pct}%` : "—"}</span>
                  </p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Main tabs */}
      <Tabs defaultValue="canais">
        <TabsList>
          <TabsTrigger value="canais">Por Canal</TabsTrigger>
          <TabsTrigger value="produtos">Por Produto</TabsTrigger>
        </TabsList>

        {/* Por Canal */}
        <TabsContent value="canais" className="space-y-5 mt-4">
          <Card>
            <CardHeader className="pb-0 pt-4">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {metrica === 'faturamento' ? 'Faturamento R$' : 'Pedidos'} — evolução mensal
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-3">
              {vendasLoading ? (
                <Skeleton className="h-[280px] w-full" />
              ) : !hasVendas ? (
                <p className="py-12 text-center text-sm text-muted-foreground">{vendas.isError ? "Gráfico indisponível por falha na consulta." : "Sem registros para este período e canal."}</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={chartData} margin={{ left: 0, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="mes" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickFormatter={v =>
                        metrica === 'faturamento'
                          ? `R$${(v / 1000).toFixed(0)}k`
                          : v.toLocaleString('pt-BR')
                      }
                      width={60}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      content={(props) => <ChartTooltip {...props} metrica={metrica} />}
                      cursor={{ fill: 'hsl(var(--muted))', opacity: 0.5 }}
                    />
                    <Legend
                      iconType="square"
                      iconSize={10}
                      formatter={v => (
                        <span className="text-xs">{CANAL_CONFIG[v]?.label ?? v}</span>
                      )}
                    />
                    {canaisDisplay.map(c => (
                      <Bar
                        key={c}
                        dataKey={c}
                        stackId="a"
                        fill={(CANAL_CONFIG[c]?.color ?? "#64748B")}
                        name={c}
                        radius={canaisDisplay.indexOf(c) === canaisDisplay.length - 1
                          ? [3, 3, 0, 0]
                          : [0, 0, 0, 0]}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 pt-4 flex-row items-center justify-between space-y-0 gap-3 flex-wrap">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Detalhe por mês
              </CardTitle>
              <div className="flex items-center gap-2">
                <ToggleGroup
                  type="single"
                  value={tableView}
                  onValueChange={(v) => v && setTableView(v as 'somado' | 'canal')}
                  variant="outline"
                  size="sm"
                >
                  <ToggleGroupItem value="somado" className="text-xs px-3">Somado</ToggleGroupItem>
                  <ToggleGroupItem value="canal" className="text-xs px-3">Por canal</ToggleGroupItem>
                </ToggleGroup>
                <Button variant="outline" size="sm" onClick={handleExport} disabled={!hasVendas || vendas.isFetching} className="h-8 text-xs gap-1.5">
                  <Download size={13} />
                  Exportar CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {vendasLoading ? (
                <div className="p-4 space-y-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-9 w-full" />
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2.5 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                          Mês
                        </th>
                        {tableView === 'somado' ? (
                          <>
                            <th className="text-right py-2.5 px-3 font-medium text-xs uppercase tracking-wide text-muted-foreground">Pedidos</th>
                            <th className="text-right py-2.5 px-3 font-medium text-xs uppercase tracking-wide text-muted-foreground">Faturamento</th>
                            <th className="text-right py-2.5 px-4 font-medium text-xs uppercase tracking-wide text-muted-foreground">Ticket médio</th>
                          </>
                        ) : (
                          <>
                            {canaisDisplay.map(c => (
                              <th
                                key={c}
                                className="text-right py-2.5 px-3 font-medium text-xs uppercase tracking-wide"
                                style={{ color: (CANAL_CONFIG[c]?.color ?? "#64748B") }}
                              >
                                <span className="inline-flex items-center gap-1.5 justify-end">
                                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: (CANAL_CONFIG[c]?.color ?? "#64748B") }} />
                                  {(CANAL_CONFIG[c]?.label ?? c)}
                                </span>
                              </th>
                            ))}
                            <th className="text-right py-2.5 px-4 font-medium text-xs uppercase tracking-wide text-muted-foreground">
                              Total registrado
                            </th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {!hasVendas && <tr><td colSpan={tableView === "somado" ? 4 : canaisDisplay.length + 2} className="p-8 text-center text-muted-foreground">{vendas.isError ? "Dados indisponíveis por falha na consulta." : "Sem registros para este período e canal."}</td></tr>}
                      {tabelaMeses.map(({ mes, canais, totalFat, totalPed }) => {
                        const expanded = expandedMes === mes
                        const ticket = totalPed > 0 ? totalFat / totalPed : null
                        const colSpan = tableView === 'somado' ? 4 : canaisDisplay.length + 2
                        return (
                          <Fragment key={mes}>
                            <tr
                              className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                              onClick={() => setExpandedMes(expanded ? null : mes)}
                            >
                              <td className="py-2.5 px-4 font-medium">
                                <span className="inline-flex items-center gap-1.5">
                                  <ChevronRight
                                    size={13}
                                    className={`text-muted-foreground transition-transform ${expanded ? 'rotate-90' : ''}`}
                                  />
                                  {fmtMes(mes)}
                                </span>
                              </td>
                              {tableView === 'somado' ? (
                                <>
                                  <td className="text-right py-2.5 px-3 tabular-nums">{totalPed.toLocaleString('pt-BR')}</td>
                                  <td className="text-right py-2.5 px-3 tabular-nums font-medium">{fmtBRL(totalFat)}</td>
                                  <td className="text-right py-2.5 px-4 tabular-nums text-muted-foreground">{fmtBRL(ticket)}</td>
                                </>
                              ) : (
                                <>
                                  {canaisDisplay.map(c => {
                                    const d = canais[c]
                                    return (
                                      <td key={c} className="text-right py-2.5 px-3 tabular-nums text-sm">
                                        {d
                                          ? metrica === 'faturamento'
                                            ? fmtBRL(d.fat)
                                            : d.ped.toLocaleString('pt-BR')
                                          : <span className="text-muted-foreground">—</span>}
                                      </td>
                                    )
                                  })}
                                  <td className="text-right py-2.5 px-4 font-semibold tabular-nums">
                                    {metrica === 'faturamento'
                                      ? fmtBRL(totalFat)
                                      : totalPed.toLocaleString('pt-BR')}
                                  </td>
                                </>
                              )}
                            </tr>
                            {expanded && (
                              <tr className="bg-muted/20 border-b">
                                <td colSpan={colSpan} className="p-0">
                                  {drillLoading ? (
                                    <div className="p-4 space-y-2">
                                      {Array.from({ length: 3 }).map((_, i) => (
                                        <Skeleton key={i} className="h-6 w-full" />
                                      ))}
                                    </div>
                                  ) : drill.isError ? (
                                    <p role="alert" className="p-4 text-xs text-red-600">Não foi possível carregar os produtos deste mês. Tente atualizar.</p>
                                  ) : !drillProdutos || drillProdutos.length === 0 ? (
                                    <div className="p-4 text-xs text-muted-foreground text-center">
                                      Sem dados de produto para este mês.
                                    </div>
                                  ) : (
                                    <div className="px-4 py-3">
                                      <table className="w-full text-xs">
                                        <thead>
                                          <tr className="text-muted-foreground uppercase tracking-wide">
                                            <th className="text-left py-1.5 font-medium">Produto</th>
                                            <th className="text-left py-1.5 font-medium">SKU</th>
                                            <th className="text-right py-1.5 font-medium">Qtd</th>
                                            <th className="text-right py-1.5 font-medium">Faturamento</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {[...drillProdutos]
                                            .sort((a, b) => Number(b.faturamento) - Number(a.faturamento))
                                            .map((p, i) => (
                                              <tr key={`${p.nome}-${p.sku}-${i}`} className="border-t border-border/50">
                                                <td className="py-1.5 pr-3">{p.nome}</td>
                                                <td className="py-1.5 pr-3 font-mono text-muted-foreground">{p.sku ?? '—'}</td>
                                                <td className="py-1.5 text-right tabular-nums">{p.qtd_vendida.toLocaleString('pt-BR')}</td>
                                                <td className="py-1.5 text-right tabular-nums font-medium">{fmtBRL(Number(p.faturamento))}</td>
                                              </tr>
                                            ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        )
                      })}
                    </tbody>
                    {tableView === 'somado' && tabelaMeses.length > 0 && (
                      <tfoot>
                        <tr className="border-t bg-muted/20">
                          <td className="py-2.5 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wide">Total</td>
                          <td className="text-right py-2.5 px-3 tabular-nums font-semibold">{totaisTabela.ped.toLocaleString('pt-BR')}</td>
                          <td className="text-right py-2.5 px-3 tabular-nums font-semibold">{fmtBRL(totaisTabela.fat)}</td>
                          <td className="text-right py-2.5 px-4 tabular-nums font-semibold text-muted-foreground">{fmtBRL(totaisTabela.ticket)}</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Por Produto */}
        <TabsContent value="produtos" className="mt-4">
          <Card>
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Package size={14} />
                Produtos mais vendidos
                {canal !== 'todos' && (
                  <Badge variant="secondary" className="text-xs">
                    {CANAL_CONFIG[canal]?.label ?? canal}
                  </Badge>
                )}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Fonte: vendas_produtos no Supabase, registros marcados como NF. Quantidades e valores conforme a importação; não comprovam movimentação física ou explosão de kits.
              </p>
              <p className="text-xs text-muted-foreground">Consultado: {produtos.dataUpdatedAt && !produtos.isError ? fmtDateTime(new Date(produtos.dataUpdatedAt).toISOString()) : 'indisponível'}. Período e canal conforme os filtros acima. Atualização dos registros: {productSourceDates.length ? `${fmtDateTime(productSourceDates[0])} a ${fmtDateTime(productSourceDates[productSourceDates.length - 1])}` : 'não informada'}{productSourceDates.length < (produtosData?.length ?? 0) ? '; há registros sem horário válido' : ''}.</p>
            </CardHeader>

            <CardContent className="p-0">
              {produtosLoading ? (
                <div className="p-4 space-y-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-9 w-full" />
                  ))}
                </div>
              ) : produtos.isError ? (
                <p role="alert" className="p-8 text-sm text-red-600">Produtos indisponíveis. {produtos.error instanceof Error ? produtos.error.message : "Falha na consulta; tente atualizar."}</p>
              ) : produtosAgg.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center text-muted-foreground gap-2 px-6 text-center">
                  <Package size={28} className="opacity-30" />
                  <p className="font-medium">Sem registros de produto neste período/canal</p>
                  <p className="text-xs text-balance leading-relaxed">
                    A consulta não encontrou registros. Isso não confirma ausência de vendas nem a situação da sincronização.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2.5 px-4 font-medium text-xs uppercase tracking-wide text-muted-foreground w-8">#</th>
                        <th className="text-left py-2.5 px-3 font-medium text-xs uppercase tracking-wide text-muted-foreground">Produto</th>
                        <th className="text-right py-2.5 px-3 font-medium text-xs uppercase tracking-wide text-muted-foreground">Qtd</th>
                        <th className="text-right py-2.5 px-3 font-medium text-xs uppercase tracking-wide text-muted-foreground">Faturamento</th>
                        <th className="text-right py-2.5 px-4 font-medium text-xs uppercase tracking-wide text-muted-foreground">% total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {produtosAgg.map((p, i) => {
                        const pct = produtosTotal > 0 ? (p.fat / produtosTotal) * 100 : null
                        return (
                          <tr key={p.sku ? `sku:${p.sku}` : `nome:${p.nome}`} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                            <td className="py-2.5 px-4 text-muted-foreground text-xs font-mono">{i + 1}</td>
                            <td className="py-2.5 px-3">
                              <div className="font-medium leading-tight">{p.nome}</div>
                              {p.sku && (
                                <div className="text-xs text-muted-foreground font-mono">{p.sku}</div>
                              )}
                            </td>
                            <td className="text-right py-2.5 px-3 tabular-nums">{p.qtd.toLocaleString('pt-BR')}</td>
                            <td className="text-right py-2.5 px-3 tabular-nums font-medium">{fmtBRL(p.fat)}</td>
                            <td className="py-2.5 px-4">
                              <div className="flex items-center gap-2 justify-end">
                                <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden flex-shrink-0">
                                  <div
                                    className="h-full rounded-full bg-primary transition-all"
                                    style={{ width: `${pct === null ? 0 : Math.min(pct, 100)}%` }}
                                  />
                                </div>
                                <span className="text-xs tabular-nums w-9 text-right text-muted-foreground">
                                  {pct === null ? "—" : `${pct.toFixed(1)}%`}
                                </span>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t bg-muted/20">
                        <td className="py-2.5 px-4" />
                        <td className="py-2.5 px-3 font-medium text-muted-foreground text-xs">
                          {produtosAgg.length} produtos
                        </td>
                        <td className="text-right py-2.5 px-3 tabular-nums font-medium">
                          {produtosAgg.reduce((s, p) => s + p.qtd, 0).toLocaleString('pt-BR')}
                        </td>
                        <td className="text-right py-2.5 px-3 tabular-nums font-semibold">
                          {fmtBRL(produtosTotal)}
                        </td>
                        <td className="py-2.5 px-4" />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
