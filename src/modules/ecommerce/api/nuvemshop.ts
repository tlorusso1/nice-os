/** Nuvemshop via proxy autenticado. Credenciais e configuração são verificadas no servidor. */
import { apiBase, proxyFetch } from "@/lib/apiBase";

export interface NSOrder {
  id: number;
  number: number;
  status: "open" | "closed" | "cancelled" | "unpaid";
  payment_status: "pending" | "paid" | "refunded" | "voided" | "authorized";
  total: string;
  subtotal: string;
  shipping: string;
  discount: string;
  created_at: string;
  updated_at: string;
  customer: {
    id: number;
    name: string;
    email: string;
  } | null;
  products: Array<{
    id: number;
    name: string;
    price: string;
    quantity: number;
    sku: string;
  }>;
  payment_details?: {
    method: string;
    installments: number;
  };
  shipping_address?: {
    city: string;
    province: string;
  };
}

export interface NSProduct {
  id: number;
  name: { pt: string };
  description: { pt: string };
  handle: { pt: string };
  published: boolean;
  free_shipping: boolean;
  stock_management: boolean;
  variants: Array<{
    id: number;
    price: string;
    stock: number | null;
    sku: string;
    promotional_price: string | null;
  }>;
  images: Array<{ id: number; src: string }>;
  categories: Array<{ id: number; name: { pt: string } }>;
}

export interface NSStats {
  totalOrders: number;
  totalRevenue: number | null;
  avgTicket: number | null;
  pendingOrders: number;
  cancelledOrders: number;
  paidOrders: number;
}

export interface NSOverview {
  orders: NSOrder[];
  stats: NSStats;
  fetchedAt: string;
  periodStart: string | null;
  periodEnd: string | null;
  sourceUpdatedAt: string | null;
  page: number;
  pageSize: number;
}

export class NuvemshopAuthError extends Error {
  constructor(message = "A Nuvemshop recusou a autenticação da integração no servidor.") {
    super(message);
    this.name = "NuvemshopAuthError";
  }
}

export function parseNSAmount(value: unknown): number | null {
  if ((typeof value !== "number" && typeof value !== "string") || String(value).trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/** Valores descrevem exclusivamente os pedidos recebidos, nunca o total mensal. */
export function calcStats(orders: NSOrder[]): NSStats {
  const paid = orders.filter((o) => o.payment_status === "paid" && o.status !== "cancelled");
  const amounts = paid.map((o) => parseNSAmount(o.total));
  const totalRevenue = !orders.length || amounts.some((amount) => amount === null) ? null : amounts.reduce<number>((sum, amount) => sum + amount!, 0);
  return {
    totalOrders: orders.length,
    totalRevenue,
    avgTicket: paid.length && totalRevenue !== null ? totalRevenue / paid.length : null,
    pendingOrders: orders.filter((o) => o.payment_status === "pending" && o.status !== "cancelled").length,
    cancelledOrders: orders.filter((o) => o.status === "cancelled").length,
    paidOrders: paid.length,
  };
}

async function getList<T>(path: string, params: Record<string, string>): Promise<T[]> {
  const res = await proxyFetch(`${apiBase("nuvemshop")}${path}?${new URLSearchParams(params)}`);
  if (res.status === 401 || res.status === 403) throw new NuvemshopAuthError();
  if (!res.ok) throw new Error(`Consulta à Nuvemshop indisponível (HTTP ${res.status}).`);
  const data: unknown = await res.json();
  if (data && typeof data === "object" && "error" in data && data.error === "NUVEMSHOP_INVALID_TOKEN") throw new NuvemshopAuthError();
  if (!Array.isArray(data)) throw new Error("A Nuvemshop devolveu uma resposta inválida; os dados estão indisponíveis.");
  return data as T[];
}

export async function fetchNSOrders(params: { per_page?: number; page?: number; status?: string } = {}): Promise<NSOrder[]> {
  const orders = await getList<NSOrder>("/orders", {
    per_page: String(params.per_page ?? 50), page: String(params.page ?? 1),
    ...(params.status ? { status: params.status } : {}),
  });
  const seen = new Set<number>();
  for (const order of orders) {
    if (!order || !Number.isFinite(order.id) || seen.has(order.id) || !order.payment_status || !order.status || !Number.isFinite(Date.parse(order.created_at)) || !Array.isArray(order.products)) {
      throw new Error("A Nuvemshop devolveu pedidos incompletos ou duplicados. Indicadores indisponíveis.");
    }
    seen.add(order.id);
  }
  return orders;
}

export async function fetchNSOverview(): Promise<NSOverview> {
  const pageSize = 200;
  const orders = await fetchNSOrders({ per_page: pageSize, page: 1 });
  const dates = orders.map((o) => new Date(o.created_at).toISOString()).sort();
  const updates = orders.map((o) => o.updated_at).filter((value) => Number.isFinite(Date.parse(value))).map((value) => new Date(value).toISOString()).sort();
  return {
    orders, stats: calcStats(orders), fetchedAt: new Date().toISOString(),
    periodStart: dates[0] ?? null, periodEnd: dates[dates.length - 1] ?? null,
    sourceUpdatedAt: updates[updates.length - 1] ?? null, page: 1, pageSize,
  };
}

export async function fetchNSStats(): Promise<NSStats> { return (await fetchNSOverview()).stats; }

export async function fetchNSProducts(params: { per_page?: number; page?: number } = {}): Promise<NSProduct[]> {
  return getList<NSProduct>("/products", { per_page: String(params.per_page ?? 50), page: String(params.page ?? 1) });
}
