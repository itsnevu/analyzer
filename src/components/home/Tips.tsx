"use client";

import { Section } from "@/components/ui/Section";
import { Reveal } from "@/components/ui/Reveal";
import { TIPS } from "@/lib/dictionary";
import { useI18n } from "@/lib/i18n";

function TipIcon({ name }: { name: string }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const paths: Record<string, React.ReactNode> = {
    title: <path d="M4 7h16M4 12h10M4 17h7" {...common} />,
    source: <><circle cx="12" cy="12" r="9" {...common} /><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" {...common} /></>,
    date: <><rect x="4" y="5" width="16" height="16" rx="2" {...common} /><path d="M8 3v4M16 3v4M4 10h16" {...common} /></>,
    image: <><rect x="4" y="5" width="16" height="14" rx="2" {...common} /><circle cx="9" cy="10" r="1.5" {...common} /><path d="m5 17 5-4 4 3 3-2 2 2" {...common} /></>,
    bias: <path d="M12 3v18M5 8l7-5 7 5M4 12h4l-2 5a3 3 0 0 0 4 0l-2-5m8 0h4l-2 5a3 3 0 0 0 4 0l-2-5" {...common} />,
    cross: <path d="M9 12l2 2 4-4M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6l7-3Z" {...common} />,
  };
  return <svg viewBox="0 0 24 24" className="h-6 w-6">{paths[name]}</svg>;
}

export function Tips() {
  const { t } = useI18n();
  return (
    <Section eyebrow={t("tips.eyebrow")} title={t("tips.title")} intro={t("tips.intro")}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TIPS.map((tip, i) => (
          <Reveal key={tip.title} delay={i * 60}>
            <div className="neu group h-full p-6 transition-transform duration-300 hover:-translate-y-1 motion-reduce:transition-none motion-reduce:hover:translate-y-0">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-surface-sunken text-brand shadow-neu-inset-sm transition-colors group-hover:text-brand-to">
                <TipIcon name={tip.icon} />
              </span>
              <h3 className="mt-4 font-display text-base font-bold">{tip.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{tip.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
