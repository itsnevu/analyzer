"use client";

import Link from "next/link";
import { formatCount, sourceName } from "@/lib/sources";
import { Section } from "@/components/ui/Section";

export interface SourceCount {
  site: string;
  count: number;
}

function Row({ sources }: { sources: SourceCount[] }) {
  return (
    <div className="flex shrink-0 items-center gap-10 px-5">
      {sources.map((s) => (
        <Link
          key={s.site}
          href={`/blog?source=${encodeURIComponent(s.site)}`}
          className="flex items-baseline gap-2 whitespace-nowrap text-sm font-semibold uppercase tracking-wider text-ink-faint transition-colors hover:text-ink"
        >
          {sourceName(s.site)}
          <span className="font-mono text-[11px] font-medium normal-case tracking-normal text-ink-faint/80">{formatCount(s.count)}</span>
        </Link>
      ))}
    </div>
  );
}

/** The fact-checking sites the archive was collected from, with how many entries each contributed. */
export function SourcesMarquee({ sources }: { sources: SourceCount[] }) {
  if (sources.length === 0) return null;
  return (
    <Section tight>
      <p className="mb-4 text-center text-xs font-semibold uppercase tracking-[0.22em] text-ink-faint">
        Archive built from these fact-checking sources
      </p>
      <div className="neu-inset group relative overflow-hidden rounded-2xl py-5">
        {/* edge fades */}
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 sm:w-24 bg-gradient-to-r from-surface-sunken to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 sm:w-24 bg-gradient-to-l from-surface-sunken to-transparent" />
        <div className="flex w-max animate-marquee motion-reduce:animate-none group-hover:[animation-play-state:paused]">
          <Row sources={sources} />
          <Row sources={sources} />
        </div>
      </div>
    </Section>
  );
}
