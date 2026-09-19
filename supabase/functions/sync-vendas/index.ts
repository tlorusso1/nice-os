import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "apikey, authorization, content-type, x-client-info, lovable-context",
};

const TINY_TOKEN = Deno.env.get("TINY_TOKEN") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const BLING_PROXY = `${SUPABASE_URL}/functions/v1/proxy-bling`;
const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

type Mode = "incremental" | "month" | "backfill";
type Agg = { pedidos: number; faturamento: number };
type FiscalItem = {
  source: "tiny" | "bling";
  external_invoice_id: string;
  access_key: string | null;
  invoice_number: string | null;
  series: string | null;
  issued_at: string;
  channel: string;
  line_index: number;
  sku: string | null;
  product_name: string;
  quantity: number;
  unit_value: number;
  total_value: number;
  status: string;
  metadata: Record<string, unknown>;
  synced_at: string;
};

const numberValue = (value: unknown): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const raw = String(value ?? "").trim();
  if (!raw) return 0;
  if (raw.includes(",")) return Number(raw.replace(/\./g, "").replace(",", ".")) || 0;
  return Number(raw) || 0;
};

const isoDate = (date: Date) => date.toISOString().slice(0, 10);
const monthStart = (date: Date) => `${isoDate(date).slice(0, 7)}-01`;
const brDate = (date: Date) => {
  const [year, month, day] = isoDate(date).split("-");
  return `${day}/${month}/${year}`;
};
const addMonths = (date: Date, amount: number) => {
  const next = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + amount, 1));
  return next;
};
const endOfMonth = (date: Date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
const normalize = (value: unknown) => String(value ?? "").trim();
const isStockSku = (sku: string | null) => Boolean(sku && /^\s*\[B\]/i.test(sku));

function channelFromStore(name: string): string {
  const normalized = name.toLowerCase();
  if (normalized.includes("shopee")) return "shopee";
  if (normalized.includes("ritz")) return "ritz_pay";
  if (normalized.includes("nuvem") || normalized.includes("tienda")) return "nuvemshop";
  if (normalized.includes("mercado")) return "mercado_livre";
  if (normalized.includes("amazon")) return "amazon";
  if (normalized.includes("nice") || normalized.includes("são paulo") || normalized.includes("sao paulo")) return "nice_sp";
  return normalized.replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "bling";
}

async function assertAuthorized(req: Request) {
  const authorization = req.headers.get("Authorization") ?? "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  if (token && token === SERVICE_ROLE_KEY) return;
  if (!token) throw new Error("Unauthorized");
  const authClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data.user) throw new Error("Unauthorized");
  const { data: isAdmin } = await db.rpc("has_role", { _user_id: data.user.id, _role: "admin" });
  if (!isAdmin) throw new Error("Forbidden");
}

async function tinyGet(endpoint: string, params: Record<string, string>) {
  if (!TINY_TOKEN) throw new Error("TINY_TOKEN ausente");
  const query = new URLSearchParams({ token: TINY_TOKEN, formato: "json", ...params });
  const response = await fetch(`https://api.tiny.com.br/api2/${endpoint}?${query}`);
  if (!response.ok) throw new Error(`Tiny ${endpoint}: HTTP ${response.status}`);
  const json = await response.json();
  const retorno = json?.retorno;
  if (retorno?.status === "Erro" && Number(retorno?.codigo_erro) !== 20) {
    throw new Error(`Tiny ${endpoint}: ${retorno?.erros?.[0]?.erro ?? "erro da API"}`);
  }
  return json;
}

async function blingGet(path: string) {
  const response = await fetch(`${BLING_PROXY}${path}`, { headers: { apikey: ANON_KEY } });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Bling ${path}: HTTP ${response.status}`);
  if (json?.error === "BLING_INVALID_TOKEN") throw new Error("Bling token inválido ou refresh OAuth ausente");
  return json;
}

async function syncTinyOrders(from: Date, to: Date) {
  const aggregates: Record<string, Agg> = {};
  let orderCount = 0;
  let page = 1;
  let totalPages = 1;
  do {
    const json = await tinyGet("pedidos.pesquisa.php", {
      pagina: String(page), dataInicial: brDate(from), dataFinal: brDate(to),
    });
    const retorno = json?.retorno;
    totalPages = Math.max(1, Number(retorno?.numero_paginas ?? 1));
    for (const wrapper of retorno?.pedidos ?? []) {
      const order = wrapper?.pedido ?? wrapper;
      const status = normalize(order?.situacao).toLowerCase();
      if (!["aprovado", "preparando envio", "pronto para envio", "faturado", "enviado", "entregue"].includes(status)) continue;
      const [day, month, year] = normalize(order?.data_pedido).split("/");
      if (!day || !month || !year) continue;
      const key = `b2b|${year}-${month}-01`;
      aggregates[key] ??= { pedidos: 0, faturamento: 0 };
      aggregates[key].pedidos += 1;
      aggregates[key].faturamento += numberValue(order?.valor);
      orderCount += 1;
    }
    page += 1;
  } while (page <= totalPages && page <= 200);
  return { aggregates, orderCount };
}

async function blingStores() {
  const stores: Record<string, string> = {};
  for (let page = 1; page <= 10; page += 1) {
    const json = await blingGet(`/lojas?pagina=${page}&limite=100`);
    const rows = Array.isArray(json?.data) ? json.data : [];
    for (const store of rows) stores[String(store.id)] = channelFromStore(normalize(store.descricao ?? store.nome));
    if (rows.length < 100) break;
  }
  return stores;
}

async function syncBlingOrders(from: Date, to: Date, stores: Record<string, string>) {
  const aggregates: Record<string, Agg> = {};
  let orderCount = 0;
  for (let page = 1; page <= 200; page += 1) {
    const json = await blingGet(`/pedidos/vendas?pagina=${page}&limite=100&dataInicial=${isoDate(from)}&dataFinal=${isoDate(to)}`);
    const rows = Array.isArray(json?.data) ? json.data : [];
    for (const order of rows) {
      const date = normalize(order?.data).slice(0, 10);
      if (!date) continue;
      const channel = stores[String(order?.loja?.id ?? "")] ?? "bling";
      const key = `${channel}|${date.slice(0, 7)}-01`;
      aggregates[key] ??= { pedidos: 0, faturamento: 0 };
      aggregates[key].pedidos += 1;
      aggregates[key].faturamento += numberValue(order?.total ?? order?.totalProdutos);
      orderCount += 1;
    }
    if (rows.length < 100) break;
  }
  return { aggregates, orderCount };
}

function tinyInvoiceRows(detail: any, fallback: any): FiscalItem[] {
  const invoice = detail?.retorno?.nota_fiscal ?? detail?.retorno?.nota ?? detail?.nota_fiscal ?? {};
  const invoiceId = normalize(invoice.id ?? fallback.id);
  if (!invoiceId) return [];
  const issuedRaw = normalize(invoice.data_emissao ?? invoice.dataEmissao ?? fallback.data_emissao);
  const [day, month, year] = issuedRaw.split("/");
  const issuedAt = year ? `${year}-${month}-${day}` : issuedRaw.slice(0, 10);
  const status = normalize(invoice.situacao ?? fallback.situacao).toLowerCase();
  const items = Array.isArray(invoice.itens) ? invoice.itens : [];
  return items.flatMap((wrapper: any, index: number) => {
    const item = wrapper?.item ?? wrapper;
    const sku = normalize(item?.codigo ?? item?.produto?.codigo) || null;
    if (!isStockSku(sku)) return [];
    const quantity = numberValue(item?.quantidade);
    const unitValue = numberValue(item?.valor_unitario ?? item?.valor);
    return [{
      source: "tiny" as const,
      external_invoice_id: invoiceId,
      access_key: normalize(invoice.chave_acesso ?? invoice.chaveAcesso) || null,
      invoice_number: normalize(invoice.numero ?? fallback.numero) || null,
      series: normalize(invoice.serie ?? fallback.serie) || null,
      issued_at: issuedAt,
      channel: "b2b",
      line_index: index,
      sku,
      product_name: normalize(item?.descricao ?? item?.produto?.descricao ?? sku),
      quantity,
      unit_value: unitValue,
      total_value: quantity * unitValue,
      status,
      metadata: {},
      synced_at: new Date().toISOString(),
    }];
  });
}

async function syncTinyInvoices(from: Date, to: Date) {
  const items: FiscalItem[] = [];
  let invoiceCount = 0;
  for (let page = 1; page <= 200; page += 1) {
    const json = await tinyGet("notas.fiscais.pesquisa.php", {
      pagina: String(page), data_inicial: brDate(from), data_final: brDate(to), situacao: "autorizada",
    });
    const rows = json?.retorno?.notas_fiscais ?? json?.retorno?.notas ?? [];
    if (!Array.isArray(rows) || rows.length === 0) break;
    for (const wrapper of rows) {
      const invoice = wrapper?.nota_fiscal ?? wrapper?.nota ?? wrapper;
      const status = normalize(invoice?.situacao).toLowerCase();
      if (status && !status.includes("autoriz") && !status.includes("emitid")) continue;
      const id = normalize(invoice?.id);
      if (!id) continue;
      const detail = await tinyGet("nota.fiscal.obter.php", { id }).catch(() => tinyGet("notas.fiscais.obter.php", { id }));
      items.push(...tinyInvoiceRows(detail, invoice));
      invoiceCount += 1;
    }
    if (rows.length < 50) break;
  }
  return { items, invoiceCount };
}

function blingInvoiceRows(detail: any, fallback: any, stores: Record<string, string>): FiscalItem[] {
  const invoice = detail?.data ?? detail ?? {};
  const invoiceId = normalize(invoice.id ?? fallback.id);
  if (!invoiceId) return [];
  const issuedAt = normalize(invoice.dataEmissao ?? fallback.dataEmissao).slice(0, 10);
  const storeId = String(invoice?.loja?.id ?? invoice?.pedidoVenda?.loja?.id ?? fallback?.loja?.id ?? "");
  const channel = stores[storeId] ?? channelFromStore(normalize(invoice?.loja?.descricao ?? fallback?.loja?.descricao));
  const status = normalize(invoice?.situacao?.valor ?? invoice?.situacao ?? fallback?.situacao).toLowerCase();
  const lines = Array.isArray(invoice.itens) ? invoice.itens : [];
  return lines.flatMap((line: any, index: number) => {
    const sku = normalize(line?.codigo ?? line?.produto?.codigo) || null;
    if (!isStockSku(sku)) return [];
    const quantity = numberValue(line?.quantidade);
    const unitValue = numberValue(line?.valor ?? line?.valorUnitario);
    return [{
      source: "bling" as const,
      external_invoice_id: invoiceId,
      access_key: normalize(invoice.chaveAcesso ?? invoice.chave_acesso) || null,
      invoice_number: normalize(invoice.numero ?? fallback.numero) || null,
      series: normalize(invoice.serie ?? fallback.serie) || null,
      issued_at: issuedAt,
      channel,
      line_index: index,
      sku,
      product_name: normalize(line?.descricao ?? line?.produto?.descricao ?? sku),
      quantity,
      unit_value: unitValue,
      total_value: quantity * unitValue,
      status,
      metadata: { store_id: storeId || null },
      synced_at: new Date().toISOString(),
    }];
  });
}

async function syncBlingInvoices(from: Date, to: Date, stores: Record<string, string>) {
  const items: FiscalItem[] = [];
  let invoiceCount = 0;
  for (let page = 1; page <= 200; page += 1) {
    const json = await blingGet(`/nfe?pagina=${page}&limite=100&tipo=1&situacao=5&dataEmissaoInicial=${isoDate(from)}&dataEmissaoFinal=${isoDate(to)}`);
    const rows = Array.isArray(json?.data) ? json.data : [];
    for (const invoice of rows) {
      const id = normalize(invoice?.id);
      if (!id) continue;
      const detail = await blingGet(`/nfe/${id}`);
      items.push(...blingInvoiceRows(detail, invoice, stores));
      invoiceCount += 1;
    }
    if (rows.length < 100) break;
  }
  return { items, invoiceCount };
}

async function persistOrderAggregates(aggregates: Record<string, Agg>, source: string, from: Date, to: Date) {
  const rows = Object.entries(aggregates).map(([key, value]) => {
    const [channel, month] = key.split("|");
    return { mes: month, canal: channel, pedidos: value.pedidos, faturamento: Number(value.faturamento.toFixed(2)), fonte: source, atualizado_em: new Date().toISOString() };
  });
  await db.from("vendas_canais").delete().eq("fonte", source).gte("mes", monthStart(from)).lte("mes", monthStart(to));
  if (rows.length) {
    const { error } = await db.from("vendas_canais").upsert(rows, { onConflict: "mes,canal,fonte" });
    if (error) throw new Error(`Canais ${source}: ${error.message}`);
  }
  return rows.length;
}

async function persistFiscalItems(items: FiscalItem[], source: string, from: Date, to: Date) {
  await db.from("vendas_notas_itens").delete().eq("source", source).gte("issued_at", isoDate(from)).lte("issued_at", isoDate(to));
  for (let offset = 0; offset < items.length; offset += 500) {
    const { error } = await db.from("vendas_notas_itens").upsert(items.slice(offset, offset + 500), { onConflict: "source,external_invoice_id,line_index" });
    if (error) throw new Error(`Itens fiscais ${source}: ${error.message}`);
  }
}

async function rebuildFiscalProducts(from: Date, to: Date) {
  const { data, error } = await db.from("vendas_notas_itens").select("*").gte("issued_at", isoDate(from)).lte("issued_at", isoDate(to));
  if (error) throw new Error(`Leitura fiscal: ${error.message}`);
  const seenInvoices = new Set<string>();
  const aggregates = new Map<string, { mes: string; canal: string; nome: string; sku: string; qtd: number; faturamento: number }>();
  const invoiceSources = new Map<string, string>();
  for (const row of data ?? []) {
    const invoiceKey = row.access_key || `${row.source}:${row.external_invoice_id}`;
    const preferred = invoiceSources.get(invoiceKey);
    if (preferred && preferred !== row.source) continue;
    if (!preferred) invoiceSources.set(invoiceKey, row.source);
    seenInvoices.add(invoiceKey);
    const mes = `${String(row.issued_at).slice(0, 7)}-01`;
    const key = `${mes}|${row.channel}|${row.sku}`;
    const current = aggregates.get(key) ?? { mes, canal: row.channel, nome: row.product_name, sku: row.sku, qtd: 0, faturamento: 0 };
    current.qtd += numberValue(row.quantity);
    current.faturamento += numberValue(row.total_value);
    aggregates.set(key, current);
  }
  await db.from("vendas_produtos").delete().eq("fonte", "nf").gte("mes", monthStart(from)).lte("mes", monthStart(to));
  const rows = [...aggregates.values()].map((row) => ({
    mes: row.mes, canal: row.canal, nome: row.nome, sku: row.sku,
    qtd_vendida: Math.round(row.qtd), faturamento: Number(row.faturamento.toFixed(2)), fonte: "nf", atualizado_em: new Date().toISOString(),
  }));
  for (let offset = 0; offset < rows.length; offset += 500) {
    const { error: insertError } = await db.from("vendas_produtos").upsert(rows.slice(offset, offset + 500), { onConflict: "mes,canal,sku,nome,fonte" });
    if (insertError) throw new Error(`Produtos fiscais: ${insertError.message}`);
  }
  return { products: rows.length, uniqueInvoices: seenInvoices.size };
}

async function writeRun(source: string, mode: Mode, from: Date, to: Date, status: string, metrics: Record<string, unknown>, errorMessage?: string) {
  await db.from("vendas_sync_runs").insert({
    source, mode, period_start: isoDate(from), period_end: isoDate(to), status,
    invoices: Number(metrics.invoices ?? 0), orders: Number(metrics.orders ?? 0), products: Number(metrics.products ?? 0), channels: Number(metrics.channels ?? 0),
    error_message: errorMessage ?? null, metadata: metrics, finished_at: new Date().toISOString(),
  });
}

async function periodFor(mode: Mode, months: number) {
  const now = new Date();
  if (mode === "incremental") {
    const from = new Date(now);
    from.setUTCDate(from.getUTCDate() - 7);
    return { from, to: now };
  }
  if (mode === "month") return { from: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)), to: now };
  const { data } = await db.from("vendas_sync_state").select("next_month").eq("source", "tiny_bling").maybeSingle();
  const fallback = addMonths(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)), -months + 1);
  const from = data?.next_month ? new Date(`${data.next_month}T00:00:00Z`) : fallback;
  return { from, to: endOfMonth(from) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    await assertAuthorized(req);
    const body = await req.json().catch(() => ({}));
    const requested = normalize(body.mode);
    const mode: Mode = requested === "backfill" ? "backfill" : requested === "month" ? "month" : "incremental";
    const months = Math.min(Math.max(Number(body.months) || 24, 1), 60);
    const { from, to } = await periodFor(mode, months);
    const result: Record<string, unknown> = { mode, from: isoDate(from), to: isoDate(to) };

    let stores: Record<string, string> = {};
    try { stores = await blingStores(); } catch (error) { result.blingStores = { error: (error as Error).message }; }

    for (const source of ["tiny", "bling"] as const) {
      try {
        const orders = source === "tiny" ? await syncTinyOrders(from, to) : await syncBlingOrders(from, to, stores);
        const invoices = source === "tiny" ? await syncTinyInvoices(from, to) : await syncBlingInvoices(from, to, stores);
        const channels = await persistOrderAggregates(orders.aggregates, `${source}_orders`, from, to);
        await persistFiscalItems(invoices.items, source, from, to);
        const metrics = { orders: orders.orderCount, invoices: invoices.invoiceCount, fiscalItems: invoices.items.length, channels };
        result[source] = metrics;
        await writeRun(source, mode, from, to, "success", metrics);
      } catch (error) {
        const message = (error as Error).message;
        result[source] = { error: message };
        await writeRun(source, mode, from, to, "error", {}, message);
      }
    }

    const fiscal = await rebuildFiscalProducts(from, to);
    result.fiscal = fiscal;
    if (mode === "backfill") {
      const nextMonth = addMonths(from, 1);
      const currentMonth = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
      const complete = nextMonth > currentMonth;
      await db.from("vendas_sync_state").upsert({
        source: "tiny_bling", next_month: complete ? null : isoDate(nextMonth), last_success_at: new Date().toISOString(),
        status: complete ? "complete" : "pending", attempts: 0, last_error: null,
      }, { onConflict: "source" });
      result.backfill = { complete, nextMonth: complete ? null : isoDate(nextMonth) };
    }
    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    const message = (error as Error).message;
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return new Response(JSON.stringify({ error: message }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});