import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { VerdictBadge } from "@/components/article/ArticleCard";
import { getArticleYears, getSourceCounts, listArticles, type ArticleFilter } from "@/lib/articles";
import type { Verdict } from "@/lib/detect";
import { LANGUAGE_NAME, formatCount, formatDate, sourceName } from "@/lib/sources";
import { clsx } from "@/lib/clsx";
import { VERDICT_META } from "@/lib/verdict";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Fact-Check Archive",
  description: "Thousands of dissected hoaxes in Indonesian and English: the claim, what the fact-checkers found, and the sources.",
};

const PAGE_SIZE = 20;
const VERDICTS: { key: Verdict | ""; label: string }[] = [
  { key: "", label: "All verdicts" },
  { key: "hoax", label: "Hoax" },
  { key: "misleading", label: "Misleading" },
  { key: "valid", label: "Credible" },
];
const LANGS: { key: "" | "id" | "en"; label: string }[] = [
  { key: "", label: "Both languages" },
  { key: "id", label: "Indonesian" },
  { key: "en", label: "English" },
];
// Saved searches; the words are OR-ed by the search.
const TOPICS = [
  { label: "Elections", q: "pemilu OR pilpres OR capres OR kpu OR election" },
  { label: "Health", q: "vaksin OR kesehatan OR obat OR virus OR kanker OR vaccine" },
  { label: "Scams", q: "penipuan OR undian OR hadiah OR scam OR phishing OR lottery" },
  { label: "Disasters", q: "gempa OR tsunami OR banjir OR bencana OR earthquake" },
  { label: "Religion", q: "agama OR masjid OR islam OR kristen OR gereja" },
];

type Params = Record<string, string | string[] | undefined>;

function one(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

export default async function BlogPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const q = one(sp.q).trim();
  const verdict = one(sp.verdict);
  const lang = one(sp.lang);
  const source = one(sp.source);
  const year = one(sp.year);
  const page = Number(one(sp.page)) || 1;

  const filter: ArticleFilter = {
    q: q || undefined,
    verdict: VERDICTS.some((v) => v.key === verdict && v.key) ? (verdict as Verdict) : undefined,
    lang: lang === "id" || lang === "en" ? lang : undefined,
    source: source || undefined,
    year: /^\d{4}$/.test(year) ? year : undefined,
    page,
    pageSize: PAGE_SIZE,
  };
  const [result, sources, years] = await Promise.all([listArticles(filter), getSourceCounts(), getArticleYears()]);

  const current = { q, verdict: filter.verdict ?? "", lang: filter.lang ?? "", source: filter.source ?? "", year: filter.year ?? "" };
  const href = (changes: Partial<typeof current> & { page?: number }) => {
    const next = { ...current, ...changes };
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(next)) if (v && k !== "page") params.set(k, String(v));
    if (changes.page && changes.page > 1) params.set("page", String(changes.page));
    const s = params.toString();
    return s ? `/blog?${s}` : "/blog";
  };
  const chip = (active: boolean) =>
    clsx("rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors", active ? "bg-ink text-surface-raised" : "neu-btn text-ink-muted");
  const field = "rounded-full border border-hairline bg-surface-raised px-3.5 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-brand/30";
  const filtered = Boolean(q || current.verdict || current.lang || current.source || current.year);

  return (
    <>
      <PageHeader eyebrowKey="blog.eyebrow" titleKey="blog.title" introKey="blog.intro" />
      <section className="container-page pb-8">
        {/* Search + filters (a plain GET form, so every state has a URL) */}
        <form action="/blog" method="get" className="neu space-y-4 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="relative flex-1">
              <span className="sr-only">Search the archive</span>
              <input
                type="search"
                name="q"
                defaultValue={q}
                placeholder="Search claims, names, places… e.g. vaksin, KPU, WhatsApp"
                className="w-full rounded-full border border-hairline bg-surface-sunken py-3 pl-11 pr-4 text-sm text-ink outline-none placeholder:text-ink-faint focus:ring-2 focus:ring-brand/30"
              />
              <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" strokeLinecap="round" />
              </svg>
            </label>
            <select name="source" defaultValue={current.source} className={field} aria-label="Source">
              <option value="">All sources</option>
              {sources.map((s) => (
                <option key={s.site} value={s.site}>
                  {sourceName(s.site)} ({formatCount(s.count)})
                </option>
              ))}
            </select>
            <select name="year" defaultValue={current.year} className={field} aria-label="Year">
              <option value="">Any year</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            {current.verdict && <input type="hidden" name="verdict" value={current.verdict} />}
            {current.lang && <input type="hidden" name="lang" value={current.lang} />}
            <button type="submit" className="btn-primary px-6 py-2.5 text-sm">
              Search
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {VERDICTS.map((v) => (
              <Link key={v.key} href={href({ verdict: v.key })} className={chip(current.verdict === v.key)}>
                {v.label}
              </Link>
            ))}
            <span className="mx-1 hidden h-5 w-px bg-hairline sm:block" />
            {LANGS.map((l) => (
              <Link key={l.key} href={href({ lang: l.key })} className={chip(current.lang === l.key)}>
                {l.label}
              </Link>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold uppercase tracking-[0.18em] text-ink-faint">Topics</span>
            {TOPICS.map((t) => (
              <Link key={t.label} href={href({ q: t.q })} className={clsx("rounded-full px-3 py-1 font-medium transition-colors", q === t.q ? "bg-brand-gradient text-surface" : "bg-surface-sunken text-ink-muted hover:text-ink")}>
                {t.label}
              </Link>
            ))}
          </div>
        </form>

        {/* Results */}
        <div className="mt-6 flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm text-ink-muted">
            <span className="font-semibold text-ink">{formatCount(result.total)}</span> {result.total === 1 ? "fact-check" : "fact-checks"}
            {q && (
              <>
                {" "}
                for <span className="font-medium text-ink">“{q}”</span>
              </>
            )}
          </p>
          {filtered && (
            <Link href="/blog" className="text-sm text-ink-muted hover:text-ink">
              Clear filters ×
            </Link>
          )}
        </div>

        {result.items.length === 0 ? (
          <div className="neu mt-4 p-10 text-center text-sm text-ink-muted">
            Nothing matched. Try fewer words, or{" "}
            <Link href="/detector" className="text-brand-to hover:underline">
              run the text through the detector
            </Link>
            .
          </div>
        ) : (
          <ol className="neu mt-4 divide-y divide-hairline p-0">
            {result.items.map((a) => {
              const date = formatDate(a.date);
              return (
                <li key={a.slug}>
                  <Link href={`/blog/${a.slug}`} className="group flex gap-4 p-4 transition-colors hover:bg-surface-sunken sm:p-5">
                    {a.image && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={a.image} alt="" loading="lazy" className="hidden h-20 w-28 shrink-0 rounded-lg object-cover sm:block" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <VerdictBadge verdict={a.verdict} />
                        {a.category !== VERDICT_META[a.verdict].labelEn && <span className="text-xs text-ink-faint">{a.category}</span>}
                      </div>
                      <h2 className="mt-2 font-display text-base font-bold leading-snug text-ink transition-colors group-hover:text-brand sm:text-lg">
                        {a.title}
                      </h2>
                      {a.summary && <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-ink-muted">{a.summary}</p>}
                      <p className="mt-2 text-xs text-ink-faint">
                        {[a.sourceSite && sourceName(a.sourceSite), LANGUAGE_NAME[a.lang], date].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ol>
        )}

        <Pagination page={result.page} pages={result.pages} hrefFor={(p) => href({ page: p })} />

        <p className="mt-10 text-center text-sm text-ink-faint">
          Entries are collected from public fact-checking sites and link back to the original article.
        </p>
      </section>
    </>
  );
}
