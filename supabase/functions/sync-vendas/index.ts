/**
 * sync-vendas — agrega vendas por canal/produto e grava em vendas_canais / vendas_produtos
 *
 * Body: { mode?: "month" | "backfill", months?: number }
 *   month    → sincroniza o mês corrente (default)
 *   backfill → sincroniza os últimos `months` meses (default 24)
 *
 * Fontes: Tiny (B2B) e Nuvemshop (D2C). Falha de uma fonte não derruba a outra.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "apikey, authorization, content-type, x-client-info, lovable-context",
};

const TINY_TOKEN = Deno.env.get("TINY_TOKEN") ?? "";
const NUVEMSHOP_TOKEN = Deno.env.get("NUVEMSHOP_TOKEN") ?? "";
const NUVEMSHOP_STORE_ID = Deno.env.get("NUVEMSHOP_STORE_ID") ?? "";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

type Agg = { pedidos: number; faturamento: number };
type ProdAgg = { nome: string; sku: string | null; qtd: number; faturamento: number };

const num = (v: unknown): number => {
  if (typeof v === "number") return v;
  if (typeof v === "string") return parseFloat(v.replace(/\./g, "").replace(",", ".")) || parseFloat(v) || 0;
  return 0;
};

const mesKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
const brDate = (d: Date) =>
  `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

const SITUACOES_OK = ["aprovado", "preparando envio", "pronto para envio", "faturado", "enviado", "entregue"];

// ── Tiny (B2B) ───────────────────────────────────────────────────────────────
async function tinyGet(endpoint: string, params: Record<string, string>) {
  const qs = new URLSearchParams({ token: TINY_TOKEN, formato: "json", ...params });
  const res = await fetch(`https://api.tiny.com.br/api2/${endpoint}?${qs}`);
  if (!res.ok) throw new Error(`Tiny ${endpoint}: ${res.status}`);
  return res.json();
}

async function syncTiny(from: Date, to: Date) {
  if (!TINY_TOKEN) throw new Error("TINY_TOKEN ausente");
  const canais: Record<string, Agg> = {};
  const produtos: Record<string, ProdAgg> = {};
  let pagina = 1;
  let paginas = 1;
  const pedidoIds: { id: string; mes: string }[] = [];

  do {
    const data = await tinyGet("pedidos.pesquisa.php", {
      pagina: String(pagina),
      dataInicial: brDate(from),
      dataFinal: brDate(to),
    });
    const r = data?.retorno;
    if (r?.status === "Erro" && r?.codigo_erro !== 20) break; // 20 = nenhum registro
    paginas = parseInt(r?.numero_paginas ?? "1");
    for (const row of r?.pedidos ?? []) {
      const p = row.pedido;
      if (!SITUACOES_OK.includes(String(p.situacao ?? "").toLowerCase())) continue;
      const [dd, mm, yyyy] = String(p.data_pedido ?? "").split("/");
      if (!yyyy) continue;
      const mes = `${yyyy}-${mm}-01`;
      const key = `b2b_tiny|${mes}`;
      canais[key] ??= { pedidos: 0, faturamento: 0 };
      canais[key].pedidos += 1;
      canais[key].faturamento += num(p.valor);
      pedidoIds.push({ id: String(p.id), mes });
    }
    pagina++;
  } while (pagina <= paginas && pagina <= 50);

  // Detalhe de itens — limitado para não estourar o tempo da função
  for (const { id, mes } of pedidoIds.slice(0, 300)) {
    try {
      const det = await tinyGet("pedido.obter.php", { id });
      const itens = det?.retorno?.pedido?.itens ?? [];
      for (const it of itens) {
        const item = it.item ?? it;
        const nome = String(item.descricao ?? "").trim();
        if (!nome) continue;
        const sku = item.codigo ? String(item.codigo) : null;
        const k = `b2b_tiny|${mes}|${nome}`;
        produtos[k] ??= { nome, sku, qtd: 0, faturamento: 0 };
        produtos[k].qtd += num(item.quantidade);
        produtos[k].faturamento += num(item.valor_unitario) * num(item.quantidade);
      }
    } catch (_) { /* ignora item com falha */ }
  }

  return { canais, produtos };
}

// ── Nuvemshop (D2C) ──────────────────────────────────────────────────────────
async function syncNuvemshop(from: Date, to: Date) {
  if (!NUVEMSHOP_TOKEN || !NUVEMSHOP_STORE_ID) throw new Error("Credenciais Nuvemshop ausentes");
  const canais: Record<string, Agg> = {};
  const produtos: Record<string, ProdAgg> = {};

  for (let page = 1; page <= 50; page++) {
    const qs = new URLSearchParams({
      per_page: "200",
      page: String(page),
      created_at_min: from.toISOString(),
      created_at_max: to.toISOString(),
      status: "any",
    });
    const res = await fetch(`https://api.tiendanube.com/v1/${NUVEMSHOP_STORE_ID}/orders?${qs}`, {
      headers: {
        Authentication: `bearer ${NUVEMSHOP_TOKEN}`,
        "User-Agent": "NICE OS (contato@nicefoods.com.br)",
      },
    });
    if (!res.ok) throw new Error(`Nuvemshop ${res.status}`);
    const orders = await res.json();
    if (!Array.isArray(orders) || orders.length === 0) break;

    for (const o of orders) {
      if (o.status === "cancelled") continue;
      const mes = mesKey(new Date(o.created_at));
      const key = `nuvemshop|${mes}`;
      canais[key] ??= { pedidos: 0, faturamento: 0 };
      canais[key].pedidos += 1;
      canais[key].faturamento += num(o.total);
      for (const p of o.products ?? []) {
        const nome = String(p.name ?? "").trim();
        if (!nome) continue;
        const k = `nuvemshop|${mes}|${nome}`;
        produtos[k] ??= { nome, sku: p.sku ? String(p.sku) : null, qtd: 0, faturamento: 0 };
        produtos[k].qtd += num(p.quantity);
        produtos[k].faturamento += num(p.price) * num(p.quantity);
      }
    }
    if (orders.length < 200) break;
  }

  return { canais, produtos };
}

// ── persistência ─────────────────────────────────────────────────────────────
async function persist(
  canais: Record<string, Agg>,
  produtos: Record<string, ProdAgg>,
  fonte: string,
) {
  const canalRows = Object.entries(canais).map(([k, v]) => {
    const [canal, mes] = k.split("|");
    return { mes, canal, pedidos: v.pedidos, faturamento: Number(v.faturamento.toFixed(2)), fonte, atualizado_em: new Date().toISOString() };
  });
  const prodRows = Object.entries(produtos).map(([k, v]) => {
    const [canal, mes] = k.split("|");
    return {
      mes, canal, nome: v.nome, sku: v.sku,
      qtd_vendida: Math.round(v.qtd),
      faturamento: Number(v.faturamento.toFixed(2)),
      fonte, atualizado_em: new Date().toISOString(),
    };
  });

  if (canalRows.length) {
    const { error } = await supabase.from("vendas_canais").upsert(canalRows, { onConflict: "mes,canal" });
    if (error) throw new Error(`upsert canais: ${error.message}`);
  }
  if (prodRows.length) {
    const { error } = await supabase.from("vendas_produtos").upsert(prodRows, { onConflict: "mes,canal,nome" });
    if (error) throw new Error(`upsert produtos: ${error.message}`);
  }
  return { canais: canalRows.length, produtos: prodRows.length };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const body = await req.json().catch(() => ({}));
    const mode = body.mode === "backfill" ? "backfill" : "month";
    const months = Math.min(Math.max(Number(body.months) || 24, 1), 60);

    const to = new Date();
    const from = new Date();
    if (mode === "backfill") from.setMonth(from.getMonth() - months + 1);
    from.setDate(1);
    from.setHours(0, 0, 0, 0);

    const result: Record<string, unknown> = { mode, from: from.toISOString(), to: to.toISOString() };

    try {
      const t = await syncTiny(from, to);
      result.tiny = await persist(t.canais, t.produtos, "tiny_api");
    } catch (e) {
      result.tiny = { error: String((e as Error).message) };
    }

    try {
      const n = await syncNuvemshop(from, to);
      result.nuvemshop = await persist(n.canais, n.produtos, "nuvemshop_api");
    } catch (e) {
      result.nuvemshop = { error: String((e as Error).message) };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message) }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
