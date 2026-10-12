"use client";

import { useSyncExternalStore } from "react";
import Clouds from "@/components/ui/Clouds";

/**
 * The hero's animated backdrop: soft blue clouds drifting behind the title,
 * plus the veil that fades them into the page surface so the text stays
 * legible. The surface token is read from globals.css as the active theme
 * resolves it, so light, dark and a switch between them are followed; the
 * sky palette is chosen per theme (a bright day, or a deep night). It never
 * reacts to the cursor; the clouds only drift on their own.
 */

/** The surface token as an "r g b" triplet (readSurface runs in the browser only). */
function readSurface(): string {
  return getComputedStyle(document.documentElement).getPropertyValue("--surface-rgb").trim();
}

function subscribe(onChange: () => void) {
  // ThemeToggle writes data-theme on <html>; "system" follows the OS preference.
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", onChange);
  return () => {
    observer.disconnect();
    media.removeEventListener("change", onChange);
  };
}

const TRIPLET = /^\d+\s+\d+\s+\d+$/;
/** Relative luminance of an "r g b" triplet, 0 (black) to 1 (white). */
const luminance = (triplet: string) => {
  const [r, g, b] = triplet.split(/\s+/).map(Number);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
};

/** Sky palette and veil per theme. The veil runs top → middle → bottom of the hero. */
const THEMES = {
  light: {
    sky: { skyTop: "#7db7ea", skyBottom: "#d4e7f8", cloud: "#ffffff", shade: "#c9dcee" },
    opacity: 1,
    veil: [0, 0.25, 1],
  },
  dark: {
    sky: { skyTop: "#0a1621", skyBottom: "#17232e", cloud: "#4a6885", shade: "#223a50" },
    opacity: 0.95,
    veil: [0.1, 0.5, 1],
  },
} as const;

export function HeroBackdrop() {
  const surface = useSyncExternalStore(subscribe, readSurface, () => "");
  // The server renders nothing: the canvas only exists in the browser anyway.
  if (!surface) return null;
  const valid = TRIPLET.test(surface);
  const theme = valid && luminance(surface) > 0.5 ? THEMES.light : THEMES.dark;
  const veil = (alpha: number) => `rgb(${valid ? surface.split(/\s+/).join(" ") : "23 23 22"} / ${alpha})`;

  return (
    <>
      <div
        className="pointer-events-none absolute inset-0 [mask-image:radial-gradient(130%_100%_at_50%_0%,black,transparent_92%)]"
        style={{ opacity: theme.opacity }}
      >
        <Clouds {...theme.sky} speed={0.03} scale={1.7} cover={0.4} softness={0.2} />
      </div>
      {/* Veil so hero text stays legible on top of the sky */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: `linear-gradient(to bottom, ${veil(theme.veil[0])}, ${veil(theme.veil[1])} 50%, ${veil(theme.veil[2])})` }}
      />
    </>
  );
}
