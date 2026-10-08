"use client";

import { useState } from "react";
import { clsx } from "@/lib/clsx";
import { useI18n } from "@/lib/i18n";

/**
 * Share buttons for a page or a result. `url` may be relative; it is resolved
 * in the browser so the same component works on every host.
 */
export function ShareBar({ text, url, label }: { text: string; url?: string; label?: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  const resolve = () => (url ? new URL(url, window.location.origin).toString() : window.location.href);
  const message = () => `${text}\n${resolve()}`;

  function whatsapp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(message())}`, "_blank", "noopener");
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(resolve());
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  }

  async function native() {
    try {
      await navigator.share({ text, url: resolve() });
    } catch {
      /* dismissed */
    }
  }

  const btn = "neu-btn inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-faint">{label ?? t("Share")}</span>
      <button type="button" onClick={whatsapp} className={clsx(btn, "text-[#128c7e]")}>
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
          <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5.1-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.5l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 12 12 0 0 0 4.6 4c1.7.7 2.3.8 3.1.7a2.7 2.7 0 0 0 1.8-1.3c.2-.6.2-1.1.2-1.2l-.5-.3Z" />
        </svg>
        WhatsApp
      </button>
      <button type="button" onClick={copy} className={clsx(btn, copied && "text-verdict-valid")}>
        {copied ? t("Link copied") : t("Copy link")}
      </button>
      <button type="button" onClick={native} className={clsx(btn, "sm:hidden")}>
        {t("More…")}
      </button>
    </div>
  );
}
