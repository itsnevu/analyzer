"use client";

import Link from "next/link";
import { SectionHeading } from "@/components/ui/Neu";
import { ArticleCard } from "@/components/article/ArticleCard";
import type { ArticleListItem } from "@/lib/data";
import { formatCount } from "@/lib/sources";
import { useI18n } from "@/lib/i18n";

export function RecentPosts({ articles, total }: { articles: ArticleListItem[]; total: number }) {
  const { t } = useI18n();

  return (
    <section className="container-page py-16">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <SectionHeading eyebrow={t("recent.eyebrow")} title={t("recent.title")} />
        <Link href="/blog" className="neu-btn px-5 py-2.5 text-sm font-medium">
          {t("common.viewAll")} →
        </Link>
      </div>

      {/* Search the whole archive from the home page */}
      <form action="/blog" method="get" className="neu-inset mt-8 flex flex-col gap-2 p-2 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Search the archive</span>
          <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            name="q"
            placeholder={`Search ${formatCount(total)} fact-checks… e.g. vaksin, KPU, undian`}
            className="w-full rounded-full bg-transparent py-3 pl-11 pr-4 text-sm text-ink outline-none placeholder:text-ink-faint"
          />
        </label>
        <button type="submit" className="btn-primary px-6 py-2.5 text-sm">
          Search
        </button>
      </form>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {articles.map((a) => (
          <ArticleCard key={a.slug} article={a} />
        ))}
      </div>
    </section>
  );
}
