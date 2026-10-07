import Link from "next/link";
import { ADMIN_PAGE_SIZES, adminArticleFilterFrom, getArticleStats, getArticleYears, getSourceCounts, listArticles } from "@/lib/articles";
import { ArticlesFilters } from "@/components/admin/ArticlesFilters";
import { filterQuery } from "@/lib/admin-article-query";
import { ArticlesTable } from "@/components/admin/ArticlesTable";
import { Pagination } from "@/components/ui/Pagination";
import { formatCount } from "@/lib/sources";
import { clsx } from "@/lib/clsx";

export const dynamic = "force-dynamic";
export const metadata = { title: "Articles" };

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function AdminArticlesPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const filter = adminArticleFilterFrom((k) => one(sp[k]) || undefined);
  const [result, sources, years, stats] = await Promise.all([listArticles(filter), getSourceCounts("all"), getArticleYears("all"), getArticleStats()]);

  const href = (changes: Record<string, string | number | undefined> = {}) => {
    const s = filterQuery(filter, changes);
    return s ? `/admin/articles?${s}` : "/admin/articles";
  };
  const visibility = filter.visibility ?? "all";
  const tabs = [
    { key: "all", label: "All", count: stats.total + stats.hidden },
    { key: "public", label: "Published", count: stats.total },
    { key: "hidden", label: "Hidden", count: stats.hidden },
  ] as const;
  const first = result.total ? (result.page - 1) * result.pageSize + 1 : 0;
  const last = Math.min(result.page * result.pageSize, result.total);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="eyebrow">Content</span>
          <h1 className="mt-2 font-display text-2xl font-bold">Articles ({formatCount(stats.total + stats.hidden)})</h1>
        </div>
        <Link href="/admin/articles/new" className="btn-primary px-5 py-2.5 text-sm">
          + Add Article
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={href({ visibility: t.key, page: 1 })}
            aria-current={visibility === t.key ? "page" : undefined}
            className={clsx(
              "rounded-full px-3.5 py-2 text-sm font-medium transition-colors",
              visibility === t.key ? "bg-ink text-surface-raised" : "text-ink-muted hover:bg-surface-sunken hover:text-ink",
            )}
          >
            {t.label} <span className="opacity-70">({formatCount(t.count)})</span>
          </Link>
        ))}
      </div>

      <ArticlesFilters filter={filter} options={{ sources, years, pageSizes: ADMIN_PAGE_SIZES }} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-ink-muted" role="status">
          View {formatCount(first)}–{formatCount(last)} of {formatCount(result.total)}
          {result.total !== stats.total + stats.hidden && " matching"}
        </p>
        <a href={`/api/admin/articles/export?${filterQuery(filter)}`} className="neu-btn px-4 py-2 text-sm">
          Export CSV ({formatCount(result.total)})
        </a>
      </div>

      <ArticlesTable articles={result.items} />
      <Pagination page={result.page} pages={result.pages} hrefFor={(p) => href({ page: p })} />
    </div>
  );
}
