import { ID } from "./admin-i18n";

/**
 * The admin panel's language: English (the default) or Indonesian, picked with
 * the ID/EN switch in the top bar and kept in a cookie. The public site stays
 * English-only; this applies to /admin and the /api/admin answers only.
 *
 * Strings are written in English in the code and looked up in the Indonesian
 * dictionary (./admin-i18n) by that same English text, so a missing entry
 * simply shows the English. Placeholders look like {name}; numbers passed as
 * values are formatted for the language (1,234 / 1.234).
 *
 * Safe for client and server code.
 */

export type AdminLang = "en" | "id";
export type AdminVars = Record<string, string | number>;
export type AdminT = (text: string, vars?: AdminVars) => string;

export const ADMIN_LANGS: readonly AdminLang[] = ["en", "id"];
// The same cookie as the public site's EN/ID switch (lib/site-lang), so one choice covers the site and the panel,
// and public components the panel reuses (verdict badges, the article preview) speak the same language.
export const ADMIN_LANG_COOKIE = "lang";
export const ADMIN_LANG_MAX_AGE = 365 * 24 * 60 * 60; // seconds

export function parseAdminLang(value: string | null | undefined): AdminLang {
  return value === "id" ? "id" : "en";
}

/** BCP 47 locale for number and date formatting. */
export function adminLocale(lang: AdminLang): string {
  return lang === "id" ? "id-ID" : "en-US";
}

export function formatAdminNumber(n: number, lang: AdminLang): string {
  return n.toLocaleString(adminLocale(lang));
}

/** "9 Oct 2026, 00:49" / "9 Okt 2026, 00.49", in Jakarta time. */
export function formatAdminDateTime(iso: string, lang: AdminLang): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(lang === "id" ? "id-ID" : "en-GB", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" });
}

/** "Oct 2026" / "Okt 2026" for a "YYYY-MM" month. */
export function formatAdminMonth(ym: string, lang: AdminLang): string {
  const d = new Date(`${ym}-01T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return ym;
  return d.toLocaleDateString(adminLocale(lang), { month: "short", year: "numeric", timeZone: "UTC" });
}

/** "Oct 9" / "9 Okt" for a "YYYY-MM-DD" day. */
export function formatAdminDay(day: string, lang: AdminLang): string {
  const d = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return day;
  return d.toLocaleDateString(adminLocale(lang), { month: "short", day: "numeric", timeZone: "UTC" });
}

/**
 * Marks an English string kept in a constant (a menu label, a table heading) as
 * a dictionary key. It returns the text unchanged; render it with t(label). The
 * test in tests/admin-i18n checks every tk("…") has an Indonesian entry.
 */
export const tk = (text: string): string => text;

export function makeAdminT(lang: AdminLang): AdminT {
  return (text, vars) => {
    const s = lang === "id" ? (ID[text] ?? text) : text;
    if (!vars) return s;
    return s.replace(/\{(\w+)\}/g, (whole, key: string) => {
      if (!(key in vars)) return whole;
      const v = vars[key];
      return typeof v === "number" ? formatAdminNumber(v, lang) : v;
    });
  };
}

/** Reads the language from a request's Cookie header, for route handlers. */
export function adminLangFromRequest(req: Request): AdminLang {
  const header = req.headers.get("cookie") ?? "";
  const match = header.match(new RegExp(`(?:^|;\\s*)${ADMIN_LANG_COOKIE}=([^;]*)`));
  return parseAdminLang(match?.[1]);
}

/** The translate function for a route handler's messages. */
export function adminTFromRequest(req: Request): AdminT {
  return makeAdminT(adminLangFromRequest(req));
}
