import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ID, ID_AREAS } from "@/lib/admin-i18n";
import { adminLangFromRequest, formatAdminNumber, makeAdminT } from "@/lib/admin-lang";

const ROOTS = ["src/app/admin", "src/components/admin", "src/app/api/admin"];

function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return files(p);
    return /\.tsx?$/.test(e.name) ? [p] : [];
  });
}

const sources = ROOTS.flatMap(files).map((f) => ({ file: f, code: fs.readFileSync(f, "utf8") }));
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

/** Literal first arguments of t(…) and tk(…) calls: t("…"), tk('…'). */
function calls(code: string): string[] {
  const out: string[] = [];
  for (const m of code.matchAll(/(?<![\w.$])tk?\(\s*(["'])((?:\\.|(?!\1)[^\\\n])*)\1/g)) {
    out.push(m[2].replace(/\\(["'\\])/g, "$1"));
  }
  return out;
}

describe("admin translations", () => {
  it("has an Indonesian entry for every t(\"…\") and tk(\"…\") in the panel", () => {
    const missing = sources.flatMap(({ file, code }) => calls(code).filter((k) => !(k in ID)).map((k) => `${file}: ${k}`));
    expect(missing).toEqual([]);
  });

  it("has an Indonesian entry for every keyed error a library throws", () => {
    // Routes show these through t(err.key), which the literal scan above cannot see.
    const libs = files("src/lib").map((f) => ({ file: f, code: fs.readFileSync(f, "utf8") }));
    const thrown = /new (?:MessageError|LabError|ExtractError|PageError|UploadError)\(\s*(["'])((?:\\.|(?!\1)[^\\\n])*)\1/g;
    const missing = libs.flatMap(({ file, code }) =>
      [...code.matchAll(thrown)].map((m) => m[2].replace(/\\(["'\\])/g, "$1")).filter((k) => !(k in ID)).map((k) => `${file}: ${k}`),
    );
    expect(missing).toEqual([]);
  });

  it("translates placeholder, aria-label, title and alt texts", () => {
    // A literal attribute with words in it is English the switch cannot reach; it must go through t().
    const literal = /\b(placeholder|aria-label|title|alt)="([^"]*[A-Za-z]{2,}[^"]*)"/g;
    const found = sources
      .filter(({ file }) => file.endsWith(".tsx"))
      .flatMap(({ file, code }) => [...code.matchAll(literal)].map((m) => `${file}: ${m[1]}="${m[2]}"`));
    expect(found).toEqual([]);
  });

  it("never builds a t() key from a template literal", () => {
    const bad = sources.filter(({ code }) => /(?<![\w.$])tk?\(\s*`/.test(code)).map((s) => s.file);
    expect(bad).toEqual([]);
  });

  it("keeps the same placeholders in both languages", () => {
    const wrong = Object.entries(ID).filter(([en, id]) => placeholders(en).join() !== placeholders(id).join());
    expect(wrong).toEqual([]);
  });

  it("gives a key shared by two areas the same translation", () => {
    const seen = new Map<string, string>();
    const clashes: string[] = [];
    for (const [area, dict] of Object.entries(ID_AREAS)) {
      for (const [k, v] of Object.entries(dict)) {
        const prev = seen.get(k);
        if (prev !== undefined && prev !== v) clashes.push(`${area}: "${k}" = "${v}" vs "${prev}"`);
        seen.set(k, v);
      }
    }
    expect(clashes).toEqual([]);
  });

  it("formats numbers and dates only through the admin helpers", () => {
    const fixed = sources.filter(({ code }) => /["']en-(US|GB)["']/.test(code)).map((s) => s.file);
    expect(fixed).toEqual([]);
  });

  it("translates, fills placeholders and falls back to English", () => {
    const id = makeAdminT("id");
    expect(id("Dashboard")).toBe("Dasbor");
    expect(id("Not in the dictionary")).toBe("Not in the dictionary");
    expect(makeAdminT("en")("Dashboard")).toBe("Dashboard");
    expect(formatAdminNumber(11138, "id")).toBe("11.138");
    expect(formatAdminNumber(11138, "en")).toBe("11,138");
  });

  it("reads the language cookie from a request", () => {
    const req = (cookie: string) => new Request("http://x/api/admin/x", { headers: { cookie } });
    expect(adminLangFromRequest(req("a=1; lang=id"))).toBe("id");
    expect(adminLangFromRequest(req("lang=xx"))).toBe("en");
    expect(adminLangFromRequest(req(""))).toBe("en");
  });
});
