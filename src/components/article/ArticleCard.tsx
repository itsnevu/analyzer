"use client";

import Link from "next/link";
import type { Article, ArticleListItem } from "@/lib/data";
import { VERDICT_META } from "@/lib/verdict";
import { LANGUAGE_NAME, formatDate, sourceName } from "@/lib/sources";
import { clsx } from "@/lib/clsx";

export function VerdictBadge({ verdict, className }: { verdict: Article["verdict"]; className?: string }) {
  const m = VERDICT_META[verdict];
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1",
        m.text,
        m.ring,
        className,
      )}
      style={{ background: `color-mix(in srgb, ${m.color} 12%, transparent)` }}
    >
      <span className="grid h-4 w-4 place-items-center rounded-full text-[10px]" style={{ background: m.color, color: "var(--verdict-ink)" }}>
        {m.emoji}
      </span>
      {m.labelEn}
    </span>
  );
}

/** Stand-in cover for archive entries, which have no image of their own. */
export function CoverPlaceholder({ verdict, label, className }: { verdict: Article["verdict"]; label?: string; className?: string }) {
  const m = VERDICT_META[verdict];
  return (
    <div
      aria-hidden
      className={clsx("relative flex h-full w-full items-end overflow-hidden p-4", className)}
      style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${m.color} 22%, var(--surface-sunken)), var(--surface-sunken) 70%)` }}
    >
      <span
        className="absolute -right-4 -top-8 font-display text-[9rem] font-bold leading-none opacity-[0.12]"
        style={{ color: m.color }}
      >
        {m.emoji}
      </span>
      {label && <span className="relative font-mono text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted">{label}</span>}
    </div>
  );
}

export function ArticleCard({ article }: { article: ArticleListItem }) {
  const date = formatDate(article.date);
  return (
    <Link
      href={`/blog/${article.slug}`}
      className="neu group flex flex-col overflow-hidden transition-transform duration-300 hover:-translate-y-1"
    >
      {/* Cover */}
      <div className="relative aspect-[16/9] overflow-hidden">
        {article.image ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={article.image}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <CoverPlaceholder verdict={article.verdict} label={article.sourceSite ? sourceName(article.sourceSite) : undefined} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/30 to-transparent" />
        <div className="absolute left-3 top-3">
          <VerdictBadge verdict={article.verdict} />
        </div>
        <span className="absolute right-3 top-3 rounded-md bg-black/40 px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-white/80 backdrop-blur">
          {LANGUAGE_NAME[article.lang]}
        </span>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-display text-base font-bold leading-snug text-balance transition-colors group-hover:text-brand">
          {article.title}
        </h3>
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-muted">{article.summary}</p>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-hairline pt-4 text-xs text-ink-faint">
          <span className="truncate">{article.sourceSite ? sourceName(article.sourceSite) : article.category}</span>
          {date && <span className="shrink-0">{date}</span>}
        </div>
      </div>
    </Link>
  );
}
