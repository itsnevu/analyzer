import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DICT } from "@/lib/dictionary";
import { SITE_ID, SITE_ID_AREAS } from "@/lib/site-i18n";
import { makeSiteT, siteLangFromRequest } from "@/lib/site-lang";

// The public site: everything under src/app and src/components except the admin panel.
const ADMIN = /[\\/](admin)[\\/]/;

function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return files(p);
    return /\.tsx?$/.test(e.name) ? [p] : [];
  });
}

const sources = ["src/app", "src/components"]
  .flatMap(files)
  .filter((f) => !ADMIN.test(f))
  .map((f) => ({ file: f, code: fs.readFileSync(f, "utf8") }));
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

/** Literal first arguments of t(…) and tk(…) calls. */
function calls(code: string): string[] {
  const out: string[] = [];
  for (const m of code.matchAll(/(?<![\w.$])tk?\(\s*(["'])((?:\\.|(?!\1)[^\\\n])*)\1/g)) {
    out.push(m[2].replace(/\\(["'\\])/g, "$1"));
  }
  return out;
}

describe("public site translations", () => {
  it("has Indonesian for every dictionary entry", () => {
    expect(Object.keys(DICT).filter((k) => !(k in SITE_ID))).toEqual([]);
  });

  it("has Indonesian for every t(\"…\") and tk(\"…\") on the site", () => {
    const missing = sources.flatMap(({ file, code }) => calls(code).filter((k) => !(k in SITE_ID)).map((k) => `${file}: ${k}`));
    expect(missing).toEqual([]);
  });

  it("translates placeholder, aria-label, title and alt texts", () => {
    const literal = /\b(placeholder|aria-label|title|alt)="([^"]*[A-Za-z]{2,}[^"]*)"/g;
    const found = sources
      .filter(({ file }) => file.endsWith(".tsx"))
      .flatMap(({ file, code }) => [...code.matchAll(literal)].map((m) => `${file}: ${m[1]}="${m[2]}"`));
    expect(found).toEqual([]);
  });

  it("never builds a key from a template literal", () => {
    expect(sources.filter(({ code }) => /(?<![\w.$])tk?\(\s*`/.test(code)).map((s) => s.file)).toEqual([]);
  });

  it("keeps the same placeholders in both languages", () => {
    const english = (k: string) => DICT[k] ?? k;
    expect(Object.entries(SITE_ID).filter(([k, id]) => placeholders(english(k)).join() !== placeholders(id).join())).toEqual([]);
  });

  it("gives a key shared by two areas the same translation", () => {
    const seen = new Map<string, string>();
    const clashes: string[] = [];
    for (const [area, dict] of Object.entries(SITE_ID_AREAS)) {
      for (const [k, v] of Object.entries(dict)) {
        const prev = seen.get(k);
        if (prev !== undefined && prev !== v) clashes.push(`${area}: "${k}" = "${v}" vs "${prev}"`);
        seen.set(k, v);
      }
    }
    expect(clashes).toEqual([]);
  });

  it("formats numbers and dates for the visitor's language", () => {
    const fixed = sources.filter(({ code }) => /["']en-(US|GB)["']/.test(code)).map((s) => s.file);
    expect(fixed).toEqual([]);
  });

  it("defaults to English and falls back to it", () => {
    const en = makeSiteT("en");
    const id = makeSiteT("id");
    const someKey = Object.keys(DICT)[0];
    expect(en(someKey)).toBe(DICT[someKey]);
    expect(en("Plain English")).toBe("Plain English");
    expect(id("Not in the dictionary")).toBe("Not in the dictionary");
    const req = (cookie: string) => new Request("http://x/", { headers: { cookie } });
    expect(siteLangFromRequest(req("lang=id"))).toBe("id");
    expect(siteLangFromRequest(req("admin_lang=id"))).toBe("en");
    expect(siteLangFromRequest(req(""))).toBe("en");
  });
});
