import Link from "next/link";
import { adminArticleFilterFrom, getArticleStats, getArticleYears, getSourceCounts, listArticles } from "@/lib/articles";
import { filterQuery } from "@/lib/admin-article-query";
import { ArticlesTable } from "@/components/admin/ArticlesTable";
import { AdminPageHeader, AdminTab } from "@/components/admin/AdminPage";

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

  return (
    <div>
      <AdminPageHeader
        title="Articles"
        count={stats.total + stats.hidden}
        description="The fact-check archive: published and hidden entries, with bulk publish, hide, verdict and delete for the selected rows."
        actions={
          <Link href="/admin/articles/new" className="btn-primary px-5 py-2.5 text-sm">
            + Add article
          </Link>
        }
        tabs={tabs.map((t) => (
          <AdminTab key={t.key} href={href({ visibility: t.key })} active={visibility === t.key} count={t.count}>
            {t.label}
          </AdminTab>
        ))}
      />
      <ArticlesTable
        articles={result.items}
        sources={sources}
        years={years}
        paging={{ page: result.page, pages: result.pages, total: result.total, pageSize: result.pageSize }}
        sort={filter.sort ? { key: filter.sort, order: filter.order ?? (filter.sort === "title" ? "asc" : "desc") } : undefined}
        exportHref={`/api/admin/articles/export?${filterQuery(filter)}`}
      />
    </div>
  );
}
