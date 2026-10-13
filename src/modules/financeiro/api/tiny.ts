import { finiteNumber, monthBounds } from "@/lib/dataIntegrity";
import { apiBase, proxyFetch } from "@/lib/apiBase";
// Tiny API v2 — Vite proxy em dev, Supabase Edge Function em prod
const BASE = apiBase("tiny");

async function get<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const qs = new URLSearchParams({ formato: "json", ...params });
  const res = await proxyFetch(`${BASE}/${endpoint}?${qs}`);
  if (!res.ok) throw new Error(`Tiny ${endpoint}: ${res.status}`);
  const data = await res.json();
  if (!data?.retorno) throw new Error('Resposta Tiny inválida');
  if (data.retorno.status === 'Erro' && Number(data.retorno.codigo_erro) !== 20) throw new Error('Consulta Tiny indisponível');
  return data;
}

export interface TinyPedido {
  id: string;
  numero: string;
  data_pedido: string;
  nome: string;
  valor: number;
  situacao: string;
}

interface TinySearchResponse {
  retorno: { pedidos?: Array<{ pedido: Omit<TinyPedido, 'valor'> & { valor: unknown } }> };
}

function parseValor(value: unknown): number {
  const parsed = finiteNumber(value);
  if (parsed === null) throw new Error('Valor do pedido Tiny indisponível');
  return parsed;
}

function mesAtual() {
  const { start, end } = monthBounds();
  const br = (value: string) => value.split('-').reverse().join('/');
  return { dataInicial: br(start), dataFinal: br(end) };
}

export async function getTinyPedidosMes(): Promise<TinyPedido[]> {
  const { dataInicial, dataFinal } = mesAtual();
  const data = await get<TinySearchResponse>("pedidos.pesquisa.php", { dataInicial, dataFinal });
  return (data?.retorno?.pedidos ?? []).map((p) => ({
    ...p.pedido,
    valor: parseValor(p.pedido?.valor),
  }));
}

export async function getTinyPedidosRecentes(): Promise<TinyPedido[]> {
  const data = await get<TinySearchResponse>("pedidos.pesquisa.php");
  return (data?.retorno?.pedidos ?? []).map((p) => ({
    ...p.pedido,
    valor: parseValor(p.pedido?.valor),
  }));
}
