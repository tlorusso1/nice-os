import { finiteNumber, monthBounds } from "@/lib/dataIntegrity";
import { apiBase, proxyFetch } from "@/lib/apiBase";
// Asaas API — Vite proxy em dev, Supabase Edge Function em prod
const BASE = apiBase("asaas");

export interface AsaasBalance {
  balance: number;
  totalTransferValue: number;
}

export interface AsaasPayment {
  id: string;
  customer: string;
  value: number;
  netValue: number;
  dueDate: string;
  status: string; // PENDING | RECEIVED | CONFIRMED | OVERDUE
  description: string;
  billingType: string;
}

export interface AsaasBill {
  id: string;
  description: string;
  value: number;
  dueDate: string;
  status: string;
}

async function get<T>(path: string): Promise<T> {
  const res = await proxyFetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`Asaas ${path}: ${res.status}`);
  const data = await res.json();
  if (data?.error || data?.errors) throw new Error("Integração retornou erro");
  if (path === '/finance/balance') {
    const balance = finiteNumber(data?.balance);
    if (balance === null) throw new Error('Saldo Asaas inválido');
    data.balance = balance;
  }
  if (path.startsWith('/payments?') && (!Array.isArray(data?.data) || data.data.some((row: AsaasPayment) => finiteNumber(row.value) === null))) throw new Error('Cobranças Asaas inválidas');
  if (Array.isArray(data?.data)) data.data = data.data.map((row: AsaasPayment) => ({ ...row, value: finiteNumber(row.value) }));
  return data;
}

export async function getAsaasBalance(): Promise<AsaasBalance> {
  return get<AsaasBalance>("/finance/balance");
}

export async function getAsaasReceivables(): Promise<{ data: AsaasPayment[]; totalCount: number }> {
  // Pega cobranças pendentes e vencidas
  return get("/payments?limit=100&status=PENDING,OVERDUE&sort=dueDate&order=asc");
}

export async function getAsaasReceivedThisMonth(): Promise<{ data: AsaasPayment[]; totalCount: number }> {
  const { start, end } = monthBounds();
  return get(`/payments?limit=100&status=RECEIVED,CONFIRMED&paymentDate[ge]=${start}&paymentDate[le]=${end}`);
}

export async function getAsaasOverdue(): Promise<{ data: AsaasPayment[]; totalCount: number }> {
  return get("/payments?limit=50&status=OVERDUE&sort=dueDate&order=asc");
}

export async function sendAsaasNotification(paymentId: string): Promise<void> {
  const res = await proxyFetch(`${BASE}/payments/${paymentId}/sendNotification`, { method: "POST" });
  if (!res.ok) throw new Error(`Asaas sendNotification ${paymentId}: ${res.status}`);
}

export async function deleteAsaasPayment(paymentId: string): Promise<void> {
  const res = await proxyFetch(`${BASE}/payments/${paymentId}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Asaas deletePayment ${paymentId}: ${res.status}`);
}

// URL para abrir o pagamento no painel Asaas
export function asaasPaymentUrl(paymentId: string): string {
  return `https://app.asaas.com/myAccount/payments/show/${paymentId}`;
}
