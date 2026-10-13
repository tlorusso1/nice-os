/** Pure helpers: missing/invalid values must never become a measured zero. */
export function finiteNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || !value.trim()) return null;
  const normalized = value.includes(',') ? value.replace(/\./g, '').replace(',', '.') : value;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function sumKnown(values: unknown[]): number | null {
  const parsed = values.map(finiteNumber);
  if (parsed.some(value => value === null)) return null;
  return (parsed as number[]).reduce((total, value) => total + value, 0);
}

export function monthKey(offset = 0, now = new Date()): string {
  // Set day to 1 before shifting months (March 31 must not overflow February).
  const date = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function monthBounds(now = new Date()) {
  const month = monthKey(0, now);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return { start: `${month}-01`, end: `${month}-${lastDay}` };
}

export function percentageChange(current: number | null, previous: number | null): number | null {
  // Zero/missing denominator has no meaningful percentage change.
  return current === null || previous === null || previous === 0
    ? null : (current - previous) / previous * 100;
}

export function syncFailedSources(value: unknown): string[] {
  if (!value || typeof value !== 'object') return ['resposta inválida'];
  const result = value as Record<string, unknown>;
  if (result.error) return ['sincronização'];
  return ['tiny', 'bling', 'blingStores', 'fiscal'].filter(key => {
    const entry = result[key];
    if (key === 'tiny' || key === 'bling') return !entry || typeof entry !== 'object' || Boolean((entry as Record<string, unknown>).error);
    return entry && typeof entry === 'object' && Boolean((entry as Record<string, unknown>).error);
  });
}
