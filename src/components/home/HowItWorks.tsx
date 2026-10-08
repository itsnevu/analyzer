"use client";

import { Section } from "@/components/ui/Section";
import { HOW } from "@/lib/dictionary";
import { useI18n } from "@/lib/i18n";

/** Logo tile colors (H·O·A·X) to tie the 4 steps to the brand mark. */
const STEP_COLORS = ["#3b9199", "#d1348c", "#e2903f", "#6d85a6"];

export function HowItWorks() {
  const { t } = useI18n();
  return (
    <Section id="how" eyebrow={t("how.eyebrow")} title={t("how.title")} intro={t("how.intro")}>
      <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {HOW.map((s, i) => (
          <li
            key={s.step}
            className="neu group relative overflow-hidden p-6 transition-transform duration-300 hover:-translate-y-1 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
          >
            <div
              className="absolute -right-4 -top-6 font-display text-8xl font-bold"
              style={{ color: STEP_COLORS[i] + "24" }}
            >
              {s.step}
            </div>
            <div className="relative">
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: STEP_COLORS[i] }} />
                <span className="eyebrow">{t(s.kicker)}</span>
              </span>
              <h3 className="mt-4 font-display text-lg font-bold">{t(s.title)}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{t(s.body)}</p>
            </div>
          </li>
        ))}
      </ol>
    </Section>
  );
}
