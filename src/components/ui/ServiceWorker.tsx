"use client";

import { useEffect } from "react";
import type { SiteLang } from "@/lib/site-lang";

/** Which language the worker's cached offline page is in (per browser). */
const OFFLINE_LANG_KEY = "hoax-analyzer:offline-lang";

/**
 * Registers public/sw.js in production builds; the dev server stays worker-free.
 * The worker keeps one copy of /offline; when the visitor's language differs
 * from the one that copy was saved in, it is asked to fetch it again (the
 * request carries the language cookie), so the offline page matches the site.
 */
export function ServiceWorker({ lang = "en" }: { lang?: SiteLang }) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js")
      .then(() => navigator.serviceWorker.ready)
      .then((reg) => {
        let saved: string | null = null;
        try {
          saved = localStorage.getItem(OFFLINE_LANG_KEY);
        } catch {
          /* storage unavailable: refresh every time, it is one small request */
        }
        if (saved === lang) return;
        reg.active?.postMessage({ type: "refresh-offline" });
        try {
          localStorage.setItem(OFFLINE_LANG_KEY, lang);
        } catch {
          /* ignore */
        }
      })
      .catch(() => {
        /* not critical: the site works without it */
      });
  }, [lang]);
  return null;
}
