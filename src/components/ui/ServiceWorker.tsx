"use client";

import { useEffect } from "react";

/** Registers public/sw.js in production builds; the dev server stays worker-free. */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* not critical: the site works without it */
    });
  }, []);
  return null;
}
