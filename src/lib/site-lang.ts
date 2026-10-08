import { DICT } from "./dictionary";
import { SITE_ID } from "./site-i18n";

/**
 * The public site's language: English by default, Indonesian when the visitor
 * picks ID in the header switch (kept in a cookie). Archive content (fact-check
 * titles and bodies) keeps its own language; this covers the site's own text.
 *
 * t(key) accepts a lib/dictionary key ("hero.title.a") or plain English text
 * ("Browse the archive"). English comes from DICT (or is the text itself);
 * Indonesian comes from ./site-i18n, falling back to English when an entry is
 * missing. Placeholders look like {name}; numbers passed as values are
 * formatted for the language (1,234 / 1.234).
 *
 * Safe for client and server code.
 */

export type SiteLang = "en" | "id";
export type SiteVars = Record<string, string | number>;
export type SiteT = (key: string, vars?: SiteVars) => string;

export const SITE_LANGS: readonly SiteLang[] = ["en", "id"];
export const SITE_LANG_COOKIE = "lang";
export const SITE_LANG_MAX_AGE = 365 * 24 * 60 * 60; // seconds

export function parseSiteLang(value: string | null | undefined): SiteLang {
  return value === "id" ? "id" : "en";
}

/** BCP 47 locale for number and date formatting. */
export function siteLocale(lang: SiteLang): string {
  return lang === "id" ? "id-ID" : "en-US";
}

/**
 * Marks English text kept in a constant (a list of FAQ items, table headings)
 * as a dictionary key; returns it unchanged. Render it with t(text). The test in
 * tests/site-i18n checks every tk("…") has an Indonesian entry.
 */
export const tk = (text: string): string => text;

export function makeSiteT(lang: SiteLang): SiteT {
  return (key, vars) => {
    const s = (lang === "id" ? (SITE_ID[key] ?? DICT[key]) : DICT[key]) ?? key;
    if (!vars) return s;
    return s.replace(/\{(\w+)\}/g, (whole, name: string) => {
      if (!(name in vars)) return whole;
      const v = vars[name];
      return typeof v === "number" ? v.toLocaleString(siteLocale(lang)) : v;
    });
  };
}

/** Reads the language from a request's Cookie header, for route handlers. */
export function siteLangFromRequest(req: Request): SiteLang {
  const header = req.headers.get("cookie") ?? "";
  const match = header.match(new RegExp(`(?:^|;\\s*)${SITE_LANG_COOKIE}=([^;]*)`));
  return parseSiteLang(match?.[1]);
}

/** The translate function for a route handler's messages. */
export function siteTFromRequest(req: Request): SiteT {
  return makeSiteT(siteLangFromRequest(req));
}
