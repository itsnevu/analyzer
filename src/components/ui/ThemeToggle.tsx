"use client";

import { useLayoutEffect, useSyncExternalStore } from "react";
import { clsx } from "@/lib/clsx";

/**
 * Round button cycling System → Light → Dark. The choice lives in
 * localStorage("theme") and lands on <html data-theme>; the inline script in
 * the root layout applies it before the first paint, this component keeps it
 * current afterwards and updates the theme-color meta for the browser chrome.
 */

export type Theme = "system" | "light" | "dark";

const KEY = "theme";
const EVENT = "hoax-theme";
const ORDER: Theme[] = ["system", "light", "dark"];
const LABEL: Record<Theme, string> = { system: "System", light: "Light", dark: "Dark" };
/** Must match --surface in globals.css and viewport.themeColor in the root layout. */
const BAR_COLOR = { light: "#faf9f6", dark: "#171716" } as const;

function readStored(): Theme {
  try {
    const t = localStorage.getItem(KEY);
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

/** Puts `theme` on <html> and on the theme-color metas. */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
  // Next renders one meta per colour scheme; a forced theme colours both the same.
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    const own = /dark/.test(meta.getAttribute("media") ?? "") ? BAR_COLOR.dark : BAR_COLOR.light;
    meta.content = theme === "system" ? own : BAR_COLOR[theme];
  }
}

export function setTheme(theme: Theme): void {
  try {
    if (theme === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, theme);
  } catch {
    /* storage unavailable; the choice lasts for this page only */
  }
  applyTheme(theme);
  window.dispatchEvent(new Event(EVENT));
}

function Icon({ theme, className }: { theme: Theme; className?: string }) {
  const common = { className, fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (theme === "light") {
    return (
      <svg viewBox="0 0 24 24" {...common}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    );
  }
  if (theme === "dark") {
    return (
      <svg viewBox="0 0 24 24" {...common}>
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" {...common}>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </svg>
  );
}

export function ThemeToggle({ className }: { className?: string }) {
  // The server knows nothing about the visitor's choice, so it renders "system" and the client catches up without a mismatch.
  const theme = useSyncExternalStore(subscribe, readStored, () => "system" as Theme);

  // In development React's Strict Mode remount clears the attribute the inline script set; put it back before paint.
  useLayoutEffect(() => {
    applyTheme(readStored());
  }, []);

  const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={`Theme: ${LABEL[theme]}. Switch to ${LABEL[next].toLowerCase()}`}
      title={`Theme: ${LABEL[theme]} (click for ${LABEL[next].toLowerCase()})`}
      className={clsx("neu-btn h-10 w-10 place-items-center", className ?? "grid")}
    >
      <Icon theme={theme} className="h-[18px] w-[18px]" />
    </button>
  );
}
