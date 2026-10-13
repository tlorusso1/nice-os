import { finiteNumber } from "@/lib/dataIntegrity";
import { apiBase, proxyFetch } from "@/lib/apiBase";
// Bling API v3 — Vite proxy em dev, Supabase Edge Function em prod
const BASE = apiBase("bling");

export interface BlingContaBancaria {
  id: number;
  descricao: string;
  tipo: { id: number; descricao: string };
  saldo: number;
  situacao: number;
}

export interface BlingContaPagar {
  id: number;
  fornecedor: { id: number; nome: string };
  vencimento: string;
  valor: number;
  situacao: { id: number; valor: string };
  historico: string;
  categoria: { id: number; descricao: string };
}

export interface BlingContaReceber {
  id: number;
  cliente: { id: number; nome: string };
  vencimento: string;
  valor: number;
  situacao: { id: number; valor: string };
  historico: string;
  categoria: { id: number; descricao: string };
}

async function get<T>(path: string): Promise<T> {
  const res = await proxyFetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`Bling ${path}: ${res.status}`);
  const data = await res.json();
  if (data?.error || data?.errors) throw new Error("Integração retornou erro");
  if (!Array.isArray(data?.data)) throw new Error('Resposta Bling inválida');
  if (path.startsWith('/contas-pagar') && data.data.some((row: BlingContaPagar) => finiteNumber(row.valor) === null)) throw new Error('Valor Bling indisponível');
  if (path.startsWith('/contas-pagar')) data.data = data.data.map((row: BlingContaPagar) => ({ ...row, valor: finiteNumber(row.valor) }));
  return data;
}

export async function getBlingContasBancarias(): Promise<{ data: BlingContaBancaria[] }> {
  return get<{ data: BlingContaBancaria[] }>("/contas-bancarias?situacao=1");
}

export async function getBlingContasPagar(): Promise<{ data: BlingContaPagar[] }> {
  // Keep overdue debts from earlier months; this is explicitly a first-page snapshot.
  return get<{ data: BlingContaPagar[] }>("/contas-pagar?situacoes[]=1&pagina=1&limite=100");
}

export async function getBlingContasReceber(): Promise<{ data: BlingContaReceber[] }> {
  const now = new Date();
  const venc = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  // Situação 1 = Em aberto
  return get<{ data: BlingContaReceber[] }>(
    `/contas-receber?situacoes[]=1&dataVencimentoInicial=${venc}&pagina=1&limite=100`
  );
}
