"use client";

import { useI18n } from "@/lib/i18n";
import { clsx } from "@/lib/clsx";
import type { SiteLang } from "@/lib/site-lang";

const OPTIONS: { value: SiteLang; label: string; name: string }[] = [
  { value: "en", label: "EN", name: "English" },
  { value: "id", label: "ID", name: "Bahasa Indonesia" },
];

/** The EN/ID switch in the site header. English is the default. */
export function LangSwitch({ className }: { className?: string }) {
  const { lang, setLang, pending, t } = useI18n();
  return (
    <div
      role="group"
      aria-label={t("Language")}
      className={clsx("flex h-10 shrink-0 items-center rounded-full border border-hairline bg-surface-sunken p-0.5 text-xs font-semibold", pending && "opacity-60", className)}
    >
      {OPTIONS.map((o) => {
        const active = o.value === lang;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => setLang(o.value)}
            aria-pressed={active}
            title={o.name}
            lang={o.value}
            className={clsx("h-full rounded-full px-2.5 transition-colors", active ? "bg-ink text-surface-raised" : "text-ink-muted hover:text-ink")}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
