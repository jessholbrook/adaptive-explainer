const SESSION_LIMIT = 50;
const sessionStarts = new Map<string, number>();

export interface RateLimitStatus {
  used: number;
  limit: number;
  remaining: number;
}

export function getStatus(ip: string): RateLimitStatus {
  const used = sessionStarts.get(ip) ?? 0;
  return { used, limit: SESSION_LIMIT, remaining: Math.max(0, SESSION_LIMIT - used) };
}

export function tryConsumeSession(ip: string): RateLimitStatus & { allowed: boolean } {
  const used = sessionStarts.get(ip) ?? 0;
  if (used >= SESSION_LIMIT) {
    return { allowed: false, used, limit: SESSION_LIMIT, remaining: 0 };
  }
  sessionStarts.set(ip, used + 1);
  return {
    allowed: true,
    used: used + 1,
    limit: SESSION_LIMIT,
    remaining: SESSION_LIMIT - (used + 1),
  };
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
