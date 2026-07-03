const SESSION_LIMIT = 50;
const REQUEST_LIMIT = 400;
const WINDOW_MS = 24 * 60 * 60 * 1000;

// In-memory state is per server instance, so on serverless hosting this is
// best-effort abuse damping, not a hard quota. A durable store (KV/Redis)
// would be needed for a hard guarantee.
const sessionHits = new Map<string, number[]>();
const requestHits = new Map<string, number[]>();

export interface RateLimitStatus {
  used: number;
  limit: number;
  remaining: number;
}

function pruneWindow(hits: number[], now: number): number[] {
  return hits.filter((t) => now - t < WINDOW_MS);
}

function consume(
  map: Map<string, number[]>,
  ip: string,
  limit: number,
): RateLimitStatus & { allowed: boolean } {
  const now = Date.now();
  const hits = pruneWindow(map.get(ip) ?? [], now);
  if (hits.length >= limit) {
    map.set(ip, hits);
    return { allowed: false, used: hits.length, limit, remaining: 0 };
  }
  hits.push(now);
  map.set(ip, hits);
  return { allowed: true, used: hits.length, limit, remaining: limit - hits.length };
}

export function getStatus(ip: string): RateLimitStatus {
  const hits = pruneWindow(sessionHits.get(ip) ?? [], Date.now());
  return {
    used: hits.length,
    limit: SESSION_LIMIT,
    remaining: Math.max(0, SESSION_LIMIT - hits.length),
  };
}

/** One new lesson per call — guards /api/start. Window: 24h. */
export function tryConsumeSession(ip: string): RateLimitStatus & { allowed: boolean } {
  return consume(sessionHits, ip, SESSION_LIMIT);
}

/** One LLM request per call — guards /api/explain and /api/question. Window: 24h. */
export function tryConsumeRequest(ip: string): RateLimitStatus & { allowed: boolean } {
  return consume(requestHits, ip, REQUEST_LIMIT);
}

export function getClientIp(request: Request): string {
  // x-real-ip is set by the platform (e.g. Vercel) and not client-controlled.
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  // In x-forwarded-for, clients can prepend arbitrary entries; the last hop
  // is the one appended by the trusted proxy in front of us.
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1];
  }
  return "unknown";
}
