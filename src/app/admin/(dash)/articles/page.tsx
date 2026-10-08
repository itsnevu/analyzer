import Link from "next/link";
import type { Metadata } from "next";
import { adminArticleFilterFrom, getArticleStats, getArticleYears, getSourceCounts, listArticles } from "@/lib/articles";
import { filterQuery } from "@/lib/admin-article-query";
import { tk } from "@/lib/admin-lang";
import { getAdminT } from "@/lib/admin-lang-server";
import { ArticlesTable } from "@/components/admin/ArticlesTable";
import { AdminPageHeader, AdminTab } from "@/components/admin/AdminPage";
import { requireAdmin } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAdminT();
  return { title: t("Articles") };
}

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function AdminArticlesPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireAdmin();
  const { t } = await getAdminT();
  const sp = await searchParams;
  const filter = adminArticleFilterFrom((k) => one(sp[k]) || undefined);
  const [result, sources, years, stats] = await Promise.all([listArticles(filter), getSourceCounts("all"), getArticleYears("all"), getArticleStats()]);

  const href = (changes: Record<string, string | number | undefined> = {}) => {
    const s = filterQuery(filter, changes);
    return s ? `/admin/articles?${s}` : "/admin/articles";
  };
  const visibility = filter.visibility ?? "all";
  const tabs = [
    { key: "all", label: tk("All"), count: stats.total + stats.hidden },
    { key: "public", label: tk("Published"), count: stats.total },
    { key: "hidden", label: tk("Hidden"), count: stats.hidden },
  ] as const;

  return (
    <div>
      <AdminPageHeader
        title={t("Articles")}
        count={stats.total + stats.hidden}
        description={t("Every fact-check on the site. Tick rows to publish, hide, change the verdict or delete several at once.")}
        actions={
          <Link href="/admin/articles/new" className="btn-primary px-5 py-2.5 text-sm">
            {t("+ Add article")}
          </Link>
        }
        tabs={tabs.map((tab) => (
          <AdminTab key={tab.key} href={href({ visibility: tab.key })} active={visibility === tab.key} count={tab.count}>
            {t(tab.label)}
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
