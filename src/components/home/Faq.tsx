"use client";

import { useState } from "react";
import { Section } from "@/components/ui/Section";
import { FAQ } from "@/lib/dictionary";
import { useI18n } from "@/lib/i18n";
import { clsx } from "@/lib/clsx";

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  const { t } = useI18n();

  return (
    <Section center eyebrow={t("faq.eyebrow")} title={t("faq.title")}>
      <div className="mx-auto max-w-3xl space-y-3">
        {FAQ.map((item, i) => {
          const isOpen = open === i;
          return (
            <div key={i} className={clsx("overflow-hidden transition-all", isOpen ? "neu" : "neu-sm")}>
              <button
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left sm:px-6 sm:py-5"
                aria-expanded={isOpen}
              >
                <span className="font-medium text-ink">{t(item.q)}</span>
                <span
                  className={clsx(
                    "grid h-7 w-7 shrink-0 place-items-center rounded-full text-ink-muted transition-transform duration-300 motion-reduce:transition-none",
                    isOpen ? "rotate-45 bg-brand-gradient text-surface" : "shadow-neu-inset-sm",
                  )}
                >
                  +
                </span>
              </button>
              <div
                className={clsx(
                  "grid transition-all duration-300 ease-out motion-reduce:transition-none",
                  isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                )}
              >
                <div className="overflow-hidden">
                  <p className="px-5 pb-5 text-sm leading-relaxed text-ink-muted sm:px-6">{t(item.a)}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
