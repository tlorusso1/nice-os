/** Estoque consultado pelos proxies. Credenciais são exclusivas do servidor. */
import { apiBase, proxyFetch } from "@/lib/apiBase";

export interface SKUEstoque {
  id: string;
  nome: string;
  sku: string;
  estoqueErp: number | null;
  estoqueNuvemshop: number | null;
  divergencia: number | null;
  preco: number | null;
  urlTiny?: string;
  status: "ok" | "baixo" | "ruptura" | "divergente" | "indisponivel";
}

export interface EstoqueStats {
  totalSkus: number;
  skusRuptura: number | null;
  skusBaixo: number | null;
  skusDivergente: number | null;
  saldosConhecidos: number;
  skusComparados: number;
  coberturaMediaDias: null;
}

export interface EstoqueSnapshot {
  items: SKUEstoque[];
  fetchedAt: string;
  tinyPages: number | null;
  nuvemshop: { available: boolean; fetchedAt: string | null; error: string | null };
  warnings: string[];
}

type JsonRecord = Record<string, unknown>;
const record = (value: unknown): JsonRecord => value !== null && typeof value === "object" ? value as JsonRecord : {};

export function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || (typeof value !== "number" && typeof value !== "string") || String(value).trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function computeStatus(item: Pick<SKUEstoque, "estoqueErp" | "divergencia">): SKUEstoque["status"] {
  if (item.estoqueErp === null) return "indisponivel";
  if (item.estoqueErp <= 0) return "ruptura";
  if (item.divergencia !== null && item.divergencia !== 0) return "divergente";
  if (item.estoqueErp <= 10) return "baixo";
  return "ok";
}

async function getTinyProdutos() {
  const qs = new URLSearchParams({ formato: "json", situacao: "A", pagina: "1" });
  const res = await proxyFetch(`${apiBase("tiny")}/produtos.pesquisa.php?${qs}`);
  if (!res.ok) throw new Error(`Tiny indisponível (HTTP ${res.status}).`);
  const retorno = record(record(await res.json()).retorno);
  // Tiny pode devolver erro de aplicação com HTTP 200. Isso não é catálogo vazio.
  if (retorno.status !== "OK" || !Array.isArray(retorno.produtos)) {
    throw new Error("O Tiny não confirmou uma lista válida de produtos. Verifique a integração no servidor.");
  }
  const items = retorno.produtos.map((entry: unknown): SKUEstoque => {
    const wrapper = record(entry);
    const prod = record(wrapper.produto ?? entry);
    if (!prod.id) throw new Error("O Tiny retornou um produto sem identificador.");
    // A pesquisa de produtos pode não incluir saldo físico. Ausência é desconhecida.
    const estoqueErp = nullableNumber(prod.saldo_fisico ?? prod.estoque);
    return {
      id: String(prod.id), nome: String(prod.nome ?? prod.descricao ?? "Sem nome"), sku: String(prod.codigo ?? ""),
      estoqueErp, estoqueNuvemshop: null, divergencia: null,
      preco: nullableNumber(prod.preco_custo),
      urlTiny: `https://erp.tiny.com.br/produtos#edit/${encodeURIComponent(String(prod.id))}`,
      status: computeStatus({ estoqueErp, divergencia: null }),
    };
  });
  return { items, pages: nullableNumber(retorno.numero_paginas), fetchedAt: new Date().toISOString() };
}

async function getNSEstoque() {
  const res = await proxyFetch(`${apiBase("nuvemshop")}/products?per_page=200&page=1`);
  if (!res.ok) throw new Error(`Nuvemshop indisponível (HTTP ${res.status}).`);
  const data: unknown = await res.json();
  if (!Array.isArray(data)) throw new Error("A Nuvemshop não confirmou uma lista válida de produtos.");
  const map = new Map<string, number | null>();
  for (const rawProduct of data) {
    const product = record(rawProduct);
    if (!Array.isArray(product.variants)) throw new Error("Produto da Nuvemshop sem lista válida de variantes.");
    for (const rawVariant of product.variants) {
      const variant = record(rawVariant);
      if (typeof variant.sku !== "string" || !variant.sku.trim()) continue;
      // Estoque ilimitado/não controlado e SKU duplicado não permitem reconciliação.
      const stock = product.stock_management === false || variant.stock_management === false ? null : nullableNumber(variant.stock);
      map.set(variant.sku, map.has(variant.sku) ? null : stock);
    }
  }
  return { map, fetchedAt: new Date().toISOString() };
}

export async function fetchEstoqueSnapshot(): Promise<EstoqueSnapshot> {
  const [tiny, ns] = await Promise.allSettled([getTinyProdutos(), getNSEstoque()]);
  if (tiny.status === "rejected") throw tiny.reason;
  const warnings = [
    `Consulta limitada à página 1 do Tiny${tiny.value.pages !== null ? ` de ${tiny.value.pages}` : " (total de páginas não informado)"} e à página 1 da Nuvemshop (até 200 produtos). Os indicadores descrevem apenas os registros recebidos.`,
    "Saldo ausente, estoque não controlado ou SKU ambíguo aparece como indisponível. A pesquisa do Tiny pode não fornecer saldo físico; ausência não indica ruptura.",
  ];
  const skuCounts = new Map<string, number>();
  for (const item of tiny.value.items) skuCounts.set(item.sku, (skuCounts.get(item.sku) ?? 0) + 1);
  const items = tiny.value.items.map((item) => {
    const estoqueNuvemshop = ns.status === "fulfilled" && item.sku && skuCounts.get(item.sku) === 1 ? ns.value.map.get(item.sku) ?? null : null;
    const divergencia = item.estoqueErp !== null && estoqueNuvemshop !== null ? item.estoqueErp - estoqueNuvemshop : null;
    const merged = { ...item, estoqueNuvemshop, divergencia };
    return { ...merged, status: computeStatus(merged) };
  });
  return {
    items, fetchedAt: tiny.value.fetchedAt, tinyPages: tiny.value.pages, warnings,
    nuvemshop: ns.status === "fulfilled"
      ? { available: true, fetchedAt: ns.value.fetchedAt, error: null }
      : { available: false, fetchedAt: null, error: ns.reason instanceof Error ? ns.reason.message : "Consulta à Nuvemshop falhou." },
  };
}

export function calcEstoqueStats(skus: SKUEstoque[]): EstoqueStats {
  const known = skus.filter((s) => s.estoqueErp !== null);
  const compared = skus.filter((s) => s.divergencia !== null);
  return {
    totalSkus: skus.length,
    skusRuptura: known.length ? known.filter((s) => s.estoqueErp! <= 0).length : null,
    skusBaixo: known.length ? known.filter((s) => s.estoqueErp! > 0 && s.estoqueErp! <= 10).length : null,
    skusDivergente: compared.length ? compared.filter((s) => s.divergencia !== 0).length : null,
    saldosConhecidos: known.length, skusComparados: compared.length, coberturaMediaDias: null,
  };
}

export async function fetchEstoque(): Promise<SKUEstoque[]> { return (await fetchEstoqueSnapshot()).items; }
export async function fetchEstoqueStats(): Promise<EstoqueStats> { return calcEstoqueStats(await fetchEstoque()); }
