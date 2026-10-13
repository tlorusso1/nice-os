import { monthKey } from "@/lib/dataIntegrity";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAsaasBalance, getAsaasReceivables, getAsaasOverdue, getAsaasReceivedThisMonth, deleteAsaasPayment } from "../api/asaas";
import { getTinyPedidosMes, getTinyPedidosRecentes } from "../api/tiny";

// ── Asaas ─────────────────────────────────────────────────────
export function useAsaasBalance() {
  return useQuery({ queryKey: ["asaas", "balance"],     queryFn: getAsaasBalance,       staleTime: 1000*60*5, retry: 1 });
}
export function useAsaasReceivables() {
  return useQuery({ queryKey: ["asaas", "receivables"], queryFn: getAsaasReceivables,   staleTime: 1000*60*5, retry: 1 });
}
export function useAsaasOverdue() {
  return useQuery({ queryKey: ["asaas", "overdue"],     queryFn: getAsaasOverdue,       staleTime: 1000*60*5, retry: 1 });
}
export function useAsaasReceivedThisMonth() {
  return useQuery({ queryKey: ["asaas", "received", monthKey()], queryFn: getAsaasReceivedThisMonth, staleTime: 1000*60*5, retry: 1 });
}
export function useDeleteAsaasPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteAsaasPayment(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["asaas", "overdue"] });
      qc.invalidateQueries({ queryKey: ["asaas", "receivables"] });
    },
  });
}

// ── Tiny ──────────────────────────────────────────────────────
export function useTinyPedidosMes() {
  return useQuery({ queryKey: ["tiny", "pedidos", "mes", monthKey()],      queryFn: getTinyPedidosMes,      staleTime: 1000*60*10, retry: 1 });
}
export function useTinyPedidosRecentes() {
  return useQuery({ queryKey: ["tiny", "pedidos", "recentes"], queryFn: getTinyPedidosRecentes, staleTime: 1000*60*10, retry: 1 });
}

// ── Consolidado ───────────────────────────────────────────────
export function useSaldoConsolidado() {
  const asaas = useAsaasBalance();
  return {
    total: asaas.isError ? null : (asaas.data?.balance ?? null),
    saldoAsaas: asaas.isError ? null : (asaas.data?.balance ?? null),
    isLoading: asaas.isLoading,
    isError: asaas.isError,
  };
}
