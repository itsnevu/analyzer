import { afterEach, describe, expect, it, vi } from "vitest";
import { isBlocked, reset, take } from "@/lib/rate-limit";
import { authConfigProblem, checkPassword, createSession, verifySession } from "@/lib/auth";
import { archiveCopy, outboundLink } from "@/lib/sources";

describe("rate limits", () => {
  afterEach(() => vi.useRealTimers());

  it("allows the limit, then refuses until the window ends", () => {
    vi.useFakeTimers();
    const key = "test:window";
    for (let i = 0; i < 3; i++) expect(take(key, 3, 60_000).ok).toBe(true);
    expect(take(key, 3, 60_000)).toEqual({ ok: false, retryAfter: 60 });
    expect(isBlocked(key, 3).ok).toBe(false);
    vi.advanceTimersByTime(60_001);
    expect(take(key, 3, 60_000).ok).toBe(true);
    reset(key);
    expect(isBlocked(key, 3).ok).toBe(true);
  });
});

describe("admin auth", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("refuses the development defaults in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ADMIN_PASSWORD", "admin123");
    vi.stubEnv("AUTH_SECRET", "x".repeat(40));
    expect(authConfigProblem()).toMatch(/ADMIN_PASSWORD/);
    expect(checkPassword("admin123")).toBe(false);
    vi.stubEnv("ADMIN_PASSWORD", "a-long-enough-password");
    vi.stubEnv("AUTH_SECRET", "short");
    expect(authConfigProblem()).toMatch(/AUTH_SECRET/);
  });

  it("signs sessions and invalidates them when the password changes", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ADMIN_PASSWORD", "first-strong-password");
    vi.stubEnv("AUTH_SECRET", "s".repeat(64));
    expect(checkPassword("first-strong-password")).toBe(true);
    expect(checkPassword("wrong")).toBe(false);
    const token = createSession();
    expect(verifySession(token)).toBe(true);
    expect(verifySession(`${token}x`)).toBe(false);
    vi.stubEnv("ADMIN_PASSWORD", "second-strong-password");
    expect(verifySession(token)).toBe(false);
  });
});

describe("links to closed sources", () => {
  it("sends dead sites to the Internet Archive, near the article date", () => {
    expect(outboundLink("https://stophoax.id/blog/post/x", "2020-04-25")).toEqual({
      href: "https://web.archive.org/web/20200425/https://stophoax.id/blog/post/x",
      archived: true,
    });
    expect(outboundLink("https://turnbackhoax.id/2021/07/20/salah-x/").archived).toBe(true);
    expect(outboundLink("https://www.kompas.com/tren/read/2020/05/30/x")).toEqual({ href: "https://www.kompas.com/tren/read/2020/05/30/x", archived: false });
    expect(archiveCopy("https://a.b/c")).toBe("https://web.archive.org/web/2019/https://a.b/c");
  });
});
