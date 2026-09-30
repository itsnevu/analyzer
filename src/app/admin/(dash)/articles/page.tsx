import Link from "next/link";
import { listArticles } from "@/lib/articles";
import { ArticlesTable } from "@/components/admin/ArticlesTable";
import { Pagination } from "@/components/ui/Pagination";
import { formatCount } from "@/lib/sources";
import { clsx } from "@/lib/clsx";

export const dynamic = "force-dynamic";

const VISIBILITY = [
  { key: "all", label: "All" },
  { key: "public", label: "Published" },
  { key: "hidden", label: "Hidden" },
] as const;

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function AdminArticlesPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const q = one(sp.q).trim();
  const vis = one(sp.visibility);
  const visibility = vis === "public" || vis === "hidden" ? vis : "all";
  const page = Number(one(sp.page)) || 1;
  const result = await listArticles({ q: q || undefined, visibility, page, pageSize: 25 });

  const href = (changes: { q?: string; visibility?: string; page?: number }) => {
    const p = new URLSearchParams();
    const nextQ = changes.q ?? q;
    const nextVis = changes.visibility ?? visibility;
    if (nextQ) p.set("q", nextQ);
    if (nextVis !== "all") p.set("visibility", nextVis);
    if (changes.page && changes.page > 1) p.set("page", String(changes.page));
    const s = p.toString();
    return s ? `/admin/articles?${s}` : "/admin/articles";
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="eyebrow">Content</span>
          <h1 className="mt-2 font-display text-2xl font-bold">Articles ({formatCount(result.total)})</h1>
        </div>
        <Link href="/admin/articles/new" className="btn-primary px-5 py-2.5 text-sm">
          + Add Article
        </Link>
      </div>

      <form action="/admin/articles" method="get" className="neu flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search title or text…"
          className="flex-1 rounded-lg border border-hairline bg-surface-sunken px-3.5 py-2.5 text-sm text-ink outline-none focus:ring-2 focus:ring-brand/30"
        />
        {visibility !== "all" && <input type="hidden" name="visibility" value={visibility} />}
        <button type="submit" className="neu-btn px-5 py-2.5 text-sm">
          Search
        </button>
        <div className="flex gap-1">
          {VISIBILITY.map((v) => (
            <Link
              key={v.key}
              href={href({ visibility: v.key, page: 1 })}
              className={clsx(
                "rounded-full px-3.5 py-2 text-sm font-medium transition-colors",
                visibility === v.key ? "bg-ink text-surface-raised" : "text-ink-muted hover:bg-surface-sunken hover:text-ink",
              )}
            >
              {v.label}
            </Link>
          ))}
        </div>
      </form>

      <ArticlesTable articles={result.items} />
      <Pagination page={result.page} pages={result.pages} hrefFor={(p) => href({ page: p })} />
    </div>
  );
}
