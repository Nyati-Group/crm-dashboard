/** Simple in-memory rolling-window limiter (per server instance). */
const WINDOW_MS = 60_000;

const g = globalThis as unknown as { __nyatiHits?: Map<string, number[]> };
const hits = (g.__nyatiHits ??= new Map<string, number[]>());

export function allow(key: string, limitPerMinute: number, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  const ok = recent.length < limitPerMinute;
  if (ok) recent.push(now);
  hits.set(key, recent);
  return ok;
}

/** Assistant: at most CHAT_RATE_LIMIT_PER_MINUTE questions per user per minute (default 20). */
export function rateLimit(userKey: string, now = Date.now()): boolean {
  return allow(`chat:${userKey}`, Number(process.env.CHAT_RATE_LIMIT_PER_MINUTE ?? 20), now);
}
