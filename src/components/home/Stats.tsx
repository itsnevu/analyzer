"use client";

import { useEffect, useRef, useState } from "react";
import { Section } from "@/components/ui/Section";
import { useI18n } from "@/lib/i18n";
import { formatCount } from "@/lib/sources";

export interface StatItem {
  value: number;
  suffix: string;
  label: string;
  sub: string;
}

/**
 * Counts up from 0 once the tiles scroll into view (the section fades in at
 * the same moment, see Reveal). The real number is in the server HTML, so
 * crawlers and readers without JavaScript see it too.
 */
function useCountUp(target: number, run: boolean, duration = 1400) {
  const [value, setValue] = useState(target);
  useEffect(() => {
    if (!run || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, run, duration]);
  return value;
}

function Stat({ value, suffix, label, sub, run }: StatItem & { run: boolean }) {
  const n = useCountUp(value, run);
  const { lang } = useI18n();
  return (
    <div className="bg-surface-raised p-5 sm:p-7">
      <div className="font-display text-3xl font-bold tracking-tight tabular-nums sm:text-5xl">
        <span className="gradient-text">
          {formatCount(n, lang)}
          {suffix}
        </span>
      </div>
      <div className="mt-3 text-sm font-semibold text-ink">{label}</div>
      <div className="mt-1 text-xs text-ink-faint">{sub}</div>
    </div>
  );
}

export function Stats({ items }: { items: StatItem[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [run, setRun] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setRun(true), { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Section tight>
      <div ref={ref} className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-hairline bg-hairline shadow-neu lg:grid-cols-4">
        {items.map((s) => (
          <Stat key={s.label} {...s} run={run} />
        ))}
      </div>
    </Section>
  );
}
