"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

export interface StatItem {
  value: number;
  suffix: string;
  label: string;
  sub: string;
}

/**
 * Counts up from 0 once the tiles scroll into view. The real number is in the
 * server HTML, so crawlers and readers without JavaScript see it too.
 */
function useCountUp(target: number, run: boolean, duration = 1400) {
  const [value, setValue] = useState(target);
  // Reset to 0 before the first paint on the client, so the count-up has somewhere to start.
  useLayoutEffect(() => {
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) setValue(0);
  }, []);
  useEffect(() => {
    if (!run) return;
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
  return (
    <div className="neu p-6">
      <div className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
        <span className="gradient-text">
          {n.toLocaleString("en-US")}
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
    <section className="container-page py-12">
      <div ref={ref} className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {items.map((s) => (
          <Stat key={s.label} {...s} run={run} />
        ))}
      </div>
    </section>
  );
}
