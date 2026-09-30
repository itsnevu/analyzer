"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { clsx } from "@/lib/clsx";

export function CopyButton({ text, label }: { text: string; label?: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <button
      onClick={copy}
      className={clsx(
        "neu-btn inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium",
        copied && "text-verdict-valid",
      )}
    >
      {copied ? (
        <>
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m5 12 5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {t("res.copied")}
        </>
      ) : (
        <>
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6">
            <rect x="9" y="9" width="11" height="11" rx="2" />
            <path d="M5 15V5a2 2 0 0 1 2-2h10" strokeLinecap="round" />
          </svg>
          {label ?? t("res.copy")}
        </>
      )}
    </button>
  );
}
