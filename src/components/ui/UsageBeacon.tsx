"use client";

import { useEffect } from "react";
import { sendUsage, usageMeta } from "@/lib/usage-client";

const SENT_KEY = "hoax-analyzer:visit-sent";

/** One "visit" per browser session for the research log (see /privacy). */
export function UsageBeacon() {
  useEffect(() => {
    if (location.pathname.startsWith("/admin")) return;
    try {
      if (sessionStorage.getItem(SENT_KEY)) return;
      sessionStorage.setItem(SENT_KEY, "1");
    } catch {
      return;
    }
    sendUsage({ kind: "visit", meta: usageMeta() });
  }, []);
  return null;
}
