/**
 * Browser side of the research log (see src/lib/usage.ts and /privacy): a
 * random visitor id, the page that brought the visitor, and an optional
 * self-reported role. Client-only; every storage access may fail.
 */

const VISITOR_KEY = "hoax-analyzer:visitor";
const SESSION_KEY = "hoax-analyzer:session";
const LANDING_KEY = "hoax-analyzer:landing";
export const PROFILE_KEY = "hoax-analyzer:profile";

export interface Profile {
  role: string;
  organization: string;
}

const rid = () => (crypto.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`).replace(/-/g, "");

function stored(storage: () => Storage, key: string, make: () => string): string {
  try {
    const s = storage();
    let v = s.getItem(key);
    if (!v) s.setItem(key, (v = make()));
    return v;
  } catch {
    return "";
  }
}

export const visitorId = () => stored(() => localStorage, VISITOR_KEY, rid);

/** Where this browser session started: external referrer and utm_* parameters. */
function landing(): { referrer: string; utm: string; path: string } {
  const raw = stored(() => sessionStorage, LANDING_KEY, () => {
    let referrer = "";
    try {
      if (document.referrer && new URL(document.referrer).host !== location.host) referrer = document.referrer;
    } catch {
      /* no referrer */
    }
    const utm = [...new URLSearchParams(location.search)].filter(([k]) => k.startsWith("utm_")).map(([k, v]) => `${k}=${v}`).join("&");
    return JSON.stringify({ referrer, utm, path: location.pathname });
  });
  try {
    return JSON.parse(raw);
  } catch {
    return { referrer: "", utm: "", path: location.pathname };
  }
}

export function getProfile(): Profile | null {
  try {
    return JSON.parse(localStorage.getItem(PROFILE_KEY) ?? "null");
  } catch {
    return null;
  }
}

export function saveProfile(p: Profile) {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
  } catch {
    /* not remembered */
  }
}

/** Drops this browser's research id and saved role; later checks start a new id. */
export function forgetBrowser() {
  try {
    localStorage.removeItem(VISITOR_KEY);
    localStorage.removeItem(PROFILE_KEY);
  } catch {
    /* nothing stored */
  }
}

export function usageMeta(via = "") {
  const p = getProfile();
  return {
    visitor: visitorId(),
    session: stored(() => sessionStorage, SESSION_KEY, rid),
    ...landing(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? "",
    language: navigator.language ?? "",
    screen: `${screen.width}x${screen.height}`,
    installed: matchMedia("(display-mode: standalone)").matches ? 1 : 0,
    via,
    role: p?.role ?? "",
    organization: p?.organization ?? "",
  };
}

export function sendUsage(body: Record<string, unknown>) {
  const json = JSON.stringify(body);
  try {
    if (navigator.sendBeacon?.("/api/usage", new Blob([json], { type: "application/json" }))) return;
  } catch {
    /* fall through */
  }
  void fetch("/api/usage", { method: "POST", headers: { "Content-Type": "application/json" }, body: json, keepalive: true }).catch(() => {});
}
