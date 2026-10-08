import { afterEach, describe, expect, it, vi } from "vitest";
import { isBlocked, reset, take } from "@/lib/rate-limit";
import { authConfigProblem, checkPassword, checkTotp, createSession, totpEnabled, verifySession } from "@/lib/auth";
import { totp } from "@/lib/totp";
import { POST as login } from "@/app/api/admin/login/route";

// The login route records successful logins in the database; not needed here.
vi.mock("@/lib/admin-log", () => ({ logAdmin: vi.fn() }));
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

describe("two-factor login", () => {
  const SECRET = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP";
  // Each test starts later than the last, because the replay guard remembers the newest step used.
  let clock = Date.UTC(2030, 0, 1);
  const at = (offsetSeconds: number) => {
    clock += 10 * 60_000 + offsetSeconds * 1000;
    vi.setSystemTime(clock);
    return Math.floor(clock / 1000);
  };

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("is off without a valid ADMIN_TOTP_SECRET", () => {
    vi.stubEnv("ADMIN_TOTP_SECRET", "");
    expect(totpEnabled()).toBe(false);
    expect(checkTotp("123456")).toBe(false);
    vi.stubEnv("ADMIN_TOTP_SECRET", "not-base32!");
    expect(totpEnabled()).toBe(false);
    vi.stubEnv("ADMIN_TOTP_SECRET", "jbsw y3dp ehpk 3pxp");
    expect(totpEnabled()).toBe(true);
  });

  it("accepts a current code once and refuses to replay it or an older one", () => {
    vi.useFakeTimers();
    vi.stubEnv("ADMIN_TOTP_SECRET", SECRET);
    const now = at(0);
    const code = totp(SECRET, now);
    expect(checkTotp("12345")).toBe(false);
    expect(checkTotp(code)).toBe(true);
    expect(checkTotp(code)).toBe(false);
    expect(checkTotp(totp(SECRET, now - 30))).toBe(false);
    // The next step's code (a phone clock running ahead) is still new.
    expect(checkTotp(totp(SECRET, now + 30))).toBe(true);
  });

  it("asks for the code after a right password without counting a failure, and counts a wrong code", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ADMIN_PASSWORD", "a-strong-admin-password");
    vi.stubEnv("AUTH_SECRET", "s".repeat(64));
    vi.stubEnv("ADMIN_TOTP_SECRET", SECRET);
    const now = at(0);
    const ip = "203.0.113.77";
    const post = (body: unknown) =>
      login(new Request("http://localhost/api/admin/login", { method: "POST", headers: { "cf-connecting-ip": ip, "content-type": "application/json" }, body: JSON.stringify(body) }));

    for (let i = 0; i < 6; i++) {
      const res = await post({ password: "a-strong-admin-password" });
      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ error: "Enter the 6-digit code from your authenticator app.", needsCode: true });
    }
    expect(isBlocked(`login:${ip}`, 5).ok).toBe(true);

    const wrong = await post({ password: "a-strong-admin-password", code: "000000" === totp(SECRET, now) ? "111111" : "000000" });
    expect(wrong.status).toBe(401);
    expect((await wrong.json()).needsCode).toBeUndefined();

    const wrongPassword = await post({ password: "nope", code: totp(SECRET, now) });
    expect(wrongPassword.status).toBe(401);
    expect((await wrongPassword.json()).error).toBe("Wrong password.");

    const ok = await post({ password: "a-strong-admin-password", code: totp(SECRET, now) });
    expect(ok.status).toBe(200);
    expect(ok.headers.get("set-cookie")).toMatch(/admin_session=/);
    expect(isBlocked(`login:${ip}`, 1).ok).toBe(true); // a successful login clears the address's failures

    const replay = await post({ password: "a-strong-admin-password", code: totp(SECRET, now) });
    expect(replay.status).toBe(401);
  });

  it("logs in with the password alone when two-factor login is off", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ADMIN_PASSWORD", "a-strong-admin-password");
    vi.stubEnv("AUTH_SECRET", "s".repeat(64));
    vi.stubEnv("ADMIN_TOTP_SECRET", "");
    const res = await login(
      new Request("http://localhost/api/admin/login", { method: "POST", headers: { "cf-connecting-ip": "203.0.113.78" }, body: JSON.stringify({ password: "a-strong-admin-password" }) }),
    );
    expect(res.status).toBe(200);
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
