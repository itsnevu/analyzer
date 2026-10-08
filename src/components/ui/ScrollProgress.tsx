"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { clsx } from "@/lib/clsx";
import { useI18n } from "@/lib/i18n";

export function ScrollProgress() {
  const [progress, setProgress] = useState(0);
  const [showTop, setShowTop] = useState(false);
  const pathname = usePathname();
  const { t } = useI18n();

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const h = document.documentElement;
        const max = h.scrollHeight - h.clientHeight;
        const p = max > 0 ? (h.scrollTop / max) * 100 : 0;
        setProgress(p);
        setShowTop(h.scrollTop > 600);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  if (pathname.startsWith("/admin")) return null;

  return (
    <>
      {/* Top progress bar */}
      <div className="fixed inset-x-0 top-0 z-[60] h-0.5 bg-transparent">
        <div
          className="h-full bg-brand-gradient transition-[width] duration-150 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Back to top */}
      <button
        aria-label={t("Back to top")}
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className={clsx(
          "neu-btn fixed bottom-6 right-6 z-50 grid h-11 w-11 place-items-center transition-all duration-300",
          showTop ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0",
        )}
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
          <path d="M12 19V5M6 11l6-6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </>
  );
}
