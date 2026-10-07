import { describe, expect, it } from "vitest";
import { base32Decode, base32Encode, generateTotpSecret, hotp, isTotpSecret, otpauthUrl, totp, verifyTotp } from "@/lib/totp";

// RFC 6238 Appendix B, SHA-1: the key is the ASCII string "12345678901234567890".
const RFC_KEY = new TextEncoder().encode("12345678901234567890");
const RFC_SECRET = base32Encode(RFC_KEY);

describe("base32", () => {
  it("matches RFC 4648 test vectors", () => {
    const vectors: [string, string][] = [
      ["", ""],
      ["f", "MY"],
      ["fo", "MZXQ"],
      ["foo", "MZXW6"],
      ["foob", "MZXW6YQ"],
      ["fooba", "MZXW6YTB"],
      ["foobar", "MZXW6YTBOI"],
    ];
    for (const [plain, encoded] of vectors) {
      expect(base32Encode(new TextEncoder().encode(plain))).toBe(encoded);
      expect(new TextDecoder().decode(base32Decode(encoded))).toBe(plain);
    }
    expect(RFC_SECRET).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
  });

  it("round-trips random bytes and tolerates case, spaces, dashes and padding", () => {
    for (let n = 0; n < 40; n++) {
      const bytes = Uint8Array.from({ length: n }, (_, i) => (i * 37 + n * 11) & 0xff);
      expect(Array.from(base32Decode(base32Encode(bytes)))).toEqual(Array.from(bytes));
    }
    expect(new TextDecoder().decode(base32Decode("mzxw 6ytb-oi======"))).toBe("foobar");
    expect(() => base32Decode("MZXW1")).toThrow(/Invalid base32/);
  });

  it("generates 160-bit secrets", () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(base32Decode(secret)).toHaveLength(20);
    expect(isTotpSecret(secret)).toBe(true);
    expect(isTotpSecret("ABC")).toBe(false);
    expect(isTotpSecret("not base32!")).toBe(false);
    expect(generateTotpSecret()).not.toBe(secret);
  });
});

describe("HOTP and TOTP", () => {
  it("matches the RFC 4226 HOTP vectors", () => {
    const expected = ["755224", "287082", "359152", "969429", "338314", "254676", "287922", "162583", "399871", "520489"];
    expected.forEach((code, counter) => expect(hotp(RFC_KEY, counter)).toBe(code));
  });

  it("matches the RFC 6238 SHA-1 vectors (8 digits)", () => {
    const vectors: [number, string][] = [
      [59, "94287082"],
      [1111111109, "07081804"],
      [1111111111, "14050471"],
      [1234567890, "89005924"],
      [2000000000, "69279037"],
    ];
    for (const [time, code] of vectors) expect(totp(RFC_SECRET, time, 30, 8)).toBe(code);
  });

  it("handles counters beyond 32 bits", () => {
    // RFC 6238's last SHA-1 vector: T = 20000000000 s, counter 0x27BC86AA0.
    expect(totp(RFC_SECRET, 20000000000, 30, 8)).toBe("65353130");
  });
});

describe("verifyTotp", () => {
  const now = 1_700_000_000;
  const step = Math.floor(now / 30);

  it("accepts the current code and one step either side, and reports the step", () => {
    expect(verifyTotp(RFC_SECRET, totp(RFC_SECRET, now), 1, now)).toBe(step);
    expect(verifyTotp(RFC_SECRET, totp(RFC_SECRET, now - 30), 1, now)).toBe(step - 1);
    expect(verifyTotp(RFC_SECRET, totp(RFC_SECRET, now + 30), 1, now)).toBe(step + 1);
    const spaced = totp(RFC_SECRET, now).replace(/^(\d{3})/, "$1 ");
    expect(verifyTotp(RFC_SECRET, spaced, 1, now)).toBe(step);
  });

  it("rejects codes outside the window", () => {
    expect(verifyTotp(RFC_SECRET, totp(RFC_SECRET, now - 60), 1, now)).toBeNull();
    expect(verifyTotp(RFC_SECRET, totp(RFC_SECRET, now + 60), 1, now)).toBeNull();
    expect(verifyTotp(RFC_SECRET, totp(RFC_SECRET, now - 30), 0, now)).toBeNull();
  });

  it("rejects wrong and malformed codes", () => {
    const good = totp(RFC_SECRET, now);
    const wrong = String((Number(good) + 1) % 1_000_000).padStart(6, "0");
    expect(verifyTotp(RFC_SECRET, wrong, 1, now)).toBeNull();
    expect(verifyTotp(RFC_SECRET, "", 1, now)).toBeNull();
    expect(verifyTotp(RFC_SECRET, good.slice(0, 5), 1, now)).toBeNull();
    expect(verifyTotp(RFC_SECRET, `${good}0`, 1, now)).toBeNull();
    expect(verifyTotp(RFC_SECRET, "abcdef", 1, now)).toBeNull();
    expect(verifyTotp(base32Encode(new TextEncoder().encode("another-secret-key!!")), good, 1, now)).toBeNull();
  });
});

describe("otpauthUrl", () => {
  it("builds a Key URI apps accept", () => {
    expect(otpauthUrl("JBSWY3DPEHPK3PXP", "Hoax Analyzer", "admin")).toBe(
      "otpauth://totp/Hoax%20Analyzer:admin?secret=JBSWY3DPEHPK3PXP&issuer=Hoax%20Analyzer",
    );
  });
});
