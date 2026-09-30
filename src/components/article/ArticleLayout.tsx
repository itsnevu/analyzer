import Link from "next/link";
import type { Article, ArticleListItem } from "@/lib/data";
import { VERDICT_META } from "@/lib/verdict";
import { LANGUAGE_NAME, formatDate, hostOf, outboundLink, sourceName } from "@/lib/sources";
import { VerdictBadge } from "./ArticleCard";
import { RichText } from "./RichText";
import { ShareBar } from "./ShareBar";

function Section({ label, tone, children }: { label: string; tone?: string; children: React.ReactNode }) {
  return (
    <section className="neu-inset rounded-2xl p-5 sm:p-6" style={tone ? { borderLeft: `4px solid ${tone}` } : undefined}>
      <h2 className="eyebrow">{label}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

export function ArticleLayout({ article, related }: { article: Article; related: ArticleListItem[] }) {
  const meta = VERDICT_META[article.verdict];
  const summary = article.summaryEn || article.summaryId;
  // The summary of an imported article is the opening of its text, so it is not repeated.
  const showSummary = summary && !norm(article.explanation).startsWith(norm(summary).slice(0, 60));
  const publisher = article.sourceSite ? sourceName(article.sourceSite) : "";
  const originalHost = hostOf(article.originalUrl);
  const date = formatDate(article.date, "long");
  // Many source sites have moved or closed; their links go to the Internet Archive copy instead.
  const link = article.originalUrl ? outboundLink(article.originalUrl, article.date, article.archiveUrl) : null;

  return (
    <article className="container-page pb-8">
      <div className="mx-auto max-w-3xl">
        <div className="pt-8 sm:pt-12">
          <Link href="/blog" className="text-sm text-ink-muted transition-colors hover:text-ink">
            ← Back to the archive
          </Link>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <VerdictBadge verdict={article.verdict} />
          {article.category !== meta.labelEn && (
            <span className="rounded-md bg-surface-sunken px-2.5 py-1 text-xs font-medium text-ink-muted">{article.category}</span>
          )}
          <span className="rounded-md bg-surface-sunken px-2.5 py-1 text-xs font-medium text-ink-faint">{LANGUAGE_NAME[article.lang]}</span>
          {date && <span className="text-xs text-ink-faint">{date}</span>}
        </div>

        <h1 className="mt-4 font-display text-3xl font-bold leading-tight text-balance sm:text-4xl">{article.title}</h1>

        {publisher && (
          <p className="mt-4 text-sm text-ink-muted">
            Fact-check by{" "}
            {link ? (
              <a href={link.href} target="_blank" rel="noopener noreferrer" className="font-medium text-ink hover:text-brand-to">
                {publisher}
              </a>
            ) : (
              <span className="font-medium text-ink">{publisher}</span>
            )}
            {date && `, published ${date}`}. {link?.archived ? "The original site is no longer online; links go to the Internet Archive's copy." : "Archived here with a link to the original."}
          </p>
        )}

        {article.image && (
          <div className="neu mt-8 overflow-hidden p-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={article.image} alt="" className="aspect-[16/9] w-full object-cover" />
          </div>
        )}

        {showSummary && (
          <p className="mt-8 border-l-4 pl-5 text-lg leading-relaxed text-ink" style={{ borderColor: meta.color }}>
            {summary}
          </p>
        )}

        {!article.explanation && !article.narration && (
          <div className="neu-inset mt-8 rounded-2xl p-6 text-sm leading-relaxed text-ink-muted">
            <p>
              Only the verdict of this fact-check is kept in our archive.
              {link && !link.archived && (
                <>
                  {" "}The full explanation and sources are on{" "}
                  <span className="font-medium text-ink">{publisher || originalHost}</span>.
                </>
              )}
              {link?.archived && (
                <>
                  {" "}The original page on <span className="font-medium text-ink">{publisher || originalHost}</span> is no longer online; the Internet
                  Archive may still have a copy.
                </>
              )}
            </p>
            {link && (
              <a href={link.href} target="_blank" rel="noopener noreferrer" className="btn-primary mt-4 inline-flex px-5 py-2.5 text-sm">
                {link.archived ? "Try the archived copy ↗" : "Read the full fact-check ↗"}
              </a>
            )}
          </div>
        )}

        <div className="mt-8 space-y-4">
          {article.narration && (
            <Section label="The claim" tone={meta.color}>
              <RichText text={article.narration} className="italic text-ink-muted" />
            </Section>
          )}
          {article.explanation && (
            <Section label="What the fact-check found">
              <RichText text={article.explanation} />
            </Section>
          )}
          {article.source && (
            <Section label="Where it circulated">
              <RichText text={article.source} />
            </Section>
          )}
          {article.reference && (
            <Section label="References">
              {/* One link per line, even where the source listed several on one line */}
              <RichText text={article.reference.replace(/\s+(?=https?:\/\/)/g, "\n")} />
            </Section>
          )}
        </div>

        {link && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-hairline p-5 text-sm">
            <span className="text-ink-muted">
              Original source: <span className="font-medium text-ink">{originalHost || article.originalUrl}</span>
              {link.archived && <span className="block text-xs text-ink-faint">No longer online, so this opens the Internet Archive&apos;s copy.</span>}
            </span>
            <a href={link.href} target="_blank" rel="noopener noreferrer" className="font-medium text-brand-to hover:underline">
              {link.archived ? "Open the archived copy ↗" : "Open the original ↗"}
            </a>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-hairline p-5 sm:flex-row sm:items-center sm:justify-between">
          <ShareBar text={`${meta.labelEn}: ${article.title}`} url={`/blog/${article.slug}`} label="Pass it on" />
          <Link href="/detector" className="btn-primary px-5 py-2.5 text-center text-sm">
            Got a similar message? Check it →
          </Link>
        </div>

        {related.length > 0 && (
          <section className="mt-10">
            <h2 className="eyebrow">Related fact-checks</h2>
            <ul className="mt-4 divide-y divide-hairline rounded-2xl border border-hairline">
              {related.map((r) => (
                <li key={r.slug}>
                  <Link href={`/blog/${r.slug}`} className="flex items-start gap-3 p-4 transition-colors hover:bg-surface-sunken">
                    <VerdictBadge verdict={r.verdict} className="mt-0.5 shrink-0" />
                    <span className="min-w-0">
                      <span className="block font-medium leading-snug text-ink">{r.title}</span>
                      <span className="mt-1 block text-xs text-ink-faint">
                        {[r.sourceSite && sourceName(r.sourceSite), formatDate(r.date)].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </article>
  );
}
