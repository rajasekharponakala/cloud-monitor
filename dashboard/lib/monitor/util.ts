/** Shared helpers: fetch JSON, MTD prorating. */

export async function httpGet<T>(url: string, headers: Record<string, string> = {}): Promise<T> {
  const res = await fetch(url, { headers, cache: "no-store" });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return res.json() as Promise<T>;
}

export function parseTime(s?: string): Date {
  if (!s) return new Date();
  const d = new Date(s);
  return isNaN(d.getTime()) ? new Date() : d;
}

/** Fraction of current month elapsed since max(created, month-start). */
export function mtdFactor(created: Date): number {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const start = created < monthStart ? monthStart : created;
  if (start >= now) return 0;
  const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const monthLen = nextMonth.getTime() - monthStart.getTime();
  return Math.max(0, Math.min(1, (now.getTime() - start.getTime()) / monthLen));
}

export function prorated(createdIso: string | undefined, monthly: number): number {
  return Math.round(monthly * mtdFactor(parseTime(createdIso)) * 10000) / 10000;
}
