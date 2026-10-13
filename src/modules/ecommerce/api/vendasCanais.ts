/** Read every returned database page before exposing an aggregate. */
export async function readAllSalesRows<T extends { id: string }>(
  readPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; count: number | null; error: unknown }>,
): Promise<T[]> {
  const rows: T[] = [];
  const seen = new Set<string>();
  let expected: number | null = null;
  const maxRows = 50000;
  while (rows.length < maxRows) {
    const response = await readPage(rows.length, Math.min(rows.length + 499, maxRows - 1));
    if (response.error) throw response.error;
    if (!Array.isArray(response.data) || response.count === null || !Number.isInteger(response.count) || response.count < 0) {
      throw new Error("A consulta não confirmou a quantidade de registros. Indicadores indisponíveis.");
    }
    if (response.count > maxRows) throw new Error("O resultado excede 50.000 registros. Selecione um período menor.");
    if (expected !== null && expected !== response.count) throw new Error("Os dados mudaram durante a consulta. Atualize para recalcular os indicadores.");
    expected = response.count;
    for (const row of response.data) {
      if (!row?.id || seen.has(row.id)) throw new Error("A consulta retornou registros inválidos ou duplicados.");
      seen.add(row.id);
      rows.push(row);
    }
    if (rows.length === expected) return rows;
    if (rows.length > expected || response.data.length === 0) throw new Error("A consulta retornou dados incompletos. Indicadores indisponíveis.");
  }
  throw new Error("Não foi possível confirmar todas as páginas da consulta.");
}

export function requireSalesNumbers<T extends object>(rows: T[], keys: (keyof T)[]): T[] {
  return rows.map((row) => {
    const result = { ...row };
    for (const key of keys) {
      const value: unknown = row[key];
      if ((typeof value !== "number" && typeof value !== "string") || String(value).trim() === "" || !Number.isFinite(Number(value))) {
        throw new Error("A fonte retornou valores ausentes ou inválidos. Os indicadores não foram calculados.");
      }
      result[key] = Number(value) as T[keyof T];
    }
    return result;
  });
}
