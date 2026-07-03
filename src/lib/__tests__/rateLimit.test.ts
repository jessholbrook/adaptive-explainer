import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getClientIp,
  getStatus,
  tryConsumeRequest,
  tryConsumeSession,
} from "../rateLimit";

// Module-level state persists across tests, so each test uses a unique IP.
let n = 0;
function uniqueIp(): string {
  n += 1;
  return `10.0.0.${n}-${Math.random().toString(36).slice(2)}`;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("tryConsumeSession", () => {
  it("allows sessions up to the limit, then blocks", () => {
    const ip = uniqueIp();
    for (let i = 0; i < 50; i++) {
      expect(tryConsumeSession(ip).allowed).toBe(true);
    }
    const blocked = tryConsumeSession(ip);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("tracks IPs independently", () => {
    const a = uniqueIp();
    const b = uniqueIp();
    tryConsumeSession(a);
    expect(getStatus(a).used).toBe(1);
    expect(getStatus(b).used).toBe(0);
  });

  it("frees capacity after the 24h window passes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-01T00:00:00Z"));
    const ip = uniqueIp();
    for (let i = 0; i < 50; i++) tryConsumeSession(ip);
    expect(tryConsumeSession(ip).allowed).toBe(false);

    vi.setSystemTime(new Date("2026-07-02T00:00:01Z"));
    expect(tryConsumeSession(ip).allowed).toBe(true);
  });
});

describe("tryConsumeRequest", () => {
  it("uses a separate, larger budget than sessions", () => {
    const ip = uniqueIp();
    for (let i = 0; i < 60; i++) {
      expect(tryConsumeRequest(ip).allowed).toBe(true);
    }
    // Session budget is untouched.
    expect(getStatus(ip).used).toBe(0);
  });
});

describe("getClientIp", () => {
  function req(headers: Record<string, string>): Request {
    return new Request("http://localhost/", { headers });
  }

  it("prefers x-real-ip", () => {
    expect(
      getClientIp(req({ "x-real-ip": "1.2.3.4", "x-forwarded-for": "5.6.7.8" })),
    ).toBe("1.2.3.4");
  });

  it("uses the last (proxy-appended) entry of x-forwarded-for", () => {
    expect(getClientIp(req({ "x-forwarded-for": "spoofed, 9.9.9.9" }))).toBe("9.9.9.9");
  });

  it("falls back to unknown", () => {
    expect(getClientIp(req({}))).toBe("unknown");
  });
});
