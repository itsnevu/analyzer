"use client";

import { Starfield } from "@/components/home/Starfield";

export function HeroBackdrop() {
  return (
    <>
      <div className="pointer-events-none absolute inset-0">
        <Starfield />
      </div>
      {/* Veil: transparent at top → solid at bottom, fading into the page surface */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, transparent 0%, transparent 70%, rgba(var(--page-surface-rgb) / 0.5) 85%, rgba(var(--page-surface-rgb) / 0.9) 95%, rgb(var(--page-surface-rgb)) 100%)",
        }}
      />
    </>
  );
}
