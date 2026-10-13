/** Missing measurements are not zero. Keep genuine zeroes from the provider. */
export function metric(value: unknown): number | null {
  if (value === null || value === undefined || (typeof value !== "number" && typeof value !== "string") || (typeof value === "string" && !value.trim())) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function requireMetric(value: unknown): number {
  const number = metric(value);
  if (number === null) throw new Error("A fonte retornou métricas ausentes ou inválidas.");
  return number;
}

export function sumMetrics(values: (number | null | undefined)[]): number | null {
  if (!values.length || values.some((value) => metric(value) === null)) return null;
  return values.reduce<number>((sum, value) => sum + value!, 0);
}

export const formatMoney = (value: number | null | undefined) => metric(value) === null ? "—" :
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value!);
export const formatNumber = (value: number | null | undefined) => metric(value) === null ? "—" : value!.toLocaleString("pt-BR");
export const formatCompact = (value: number | null | undefined) => metric(value) === null ? "—" :
  Math.abs(value!) >= 1000 ? `${(value! / 1000).toFixed(1)}k` : String(value);
export const formatRate = (value: number | null | undefined, suffix = "%", digits = 2) =>
  metric(value) === null ? "—" : `${value!.toFixed(digits)}${suffix}`;

/** Retained React Query data after a refresh error is stale, not current evidence. */
export function currentData<T>(query: { data: T | undefined; isError: boolean }): T | undefined {
  return query.isError ? undefined : query.data;
}
