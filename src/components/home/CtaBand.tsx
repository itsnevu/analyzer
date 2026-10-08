"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { Section } from "@/components/ui/Section";

export function CtaBand() {
  const { t } = useI18n();
  return (
    <Section>
      <div className="neu relative overflow-hidden px-6 py-10 text-center shadow-neu-lg sm:p-16">
        <div className="pointer-events-none absolute inset-0 bg-dot-grid opacity-30" />
        <div className="pointer-events-none absolute -bottom-24 left-1/2 h-64 w-[36rem] max-w-full -translate-x-1/2 rounded-full bg-brand-gradient opacity-20 blur-[100px]" />
        <div className="relative mx-auto max-w-2xl">
          <h2 className="font-display text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            {t("cta.title.a")} <span className="gradient-text">{t("cta.title.b")}</span>
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-ink-muted">{t("cta.body")}</p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/detector" className="btn-primary px-7 py-3.5 text-base">
              {t("cta.primary")}
            </Link>
            <Link href="/report" className="neu-btn px-7 py-3.5 text-base font-medium">
              {t("cta.secondary")}
            </Link>
          </div>
        </div>
      </div>
    </Section>
  );
}
