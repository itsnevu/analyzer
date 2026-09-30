"use client";

import { SectionHeading } from "@/components/ui/Neu";
import { COMPARISON } from "@/lib/dictionary";
import { useI18n } from "@/lib/i18n";

export function FeatureComparison() {
  const { lang, t } = useI18n();
  const data = COMPARISON[lang];
  return (
    <section className="container-page py-16">
      <SectionHeading center eyebrow={t("compare.eyebrow")} title={t("compare.title")} />

      <div className="mt-12 grid gap-4 md:grid-cols-2">
        {/* With */}
        <div className="neu relative overflow-hidden p-8">
          <div className="pointer-events-none absolute inset-0 bg-radial-glow opacity-60" />
          <div className="relative">
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-gradient text-sm font-bold text-white">
                ✓
              </span>
              <h3 className="font-display text-lg font-bold">{t("compare.with")}</h3>
            </div>
            <ul className="mt-6 space-y-3.5">
              {data.withUs.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-verdict-valid/15 text-xs text-verdict-valid">
                    ✓
                  </span>
                  <span className="text-ink">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Without */}
        <div className="neu-inset p-8">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-surface text-sm font-bold text-ink-faint shadow-neu-sm">
              ✕
            </span>
            <h3 className="font-display text-lg font-bold text-ink-muted">{t("compare.without")}</h3>
          </div>
          <ul className="mt-6 space-y-3.5">
            {data.without.map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-verdict-hoax/10 text-xs text-verdict-hoax">
                  ✕
                </span>
                <span className="text-ink-muted">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
