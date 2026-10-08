import Link from "next/link";
import type { Article, ArticleListItem } from "@/lib/data";
import { VERDICT_META } from "@/lib/verdict";
import { LANGUAGE_LABEL, VERDICT_LABEL } from "@/lib/verdict-labels";
import { getSiteT } from "@/lib/site-lang-server";
import type { SiteT } from "@/lib/site-lang";
import { formatDate, hostOf, outboundLink, sourceName } from "@/lib/sources";
import { ArrowLeftIcon, ArrowRightIcon, ArchiveIcon, ClockIcon, ExternalIcon } from "@/components/ui/Icons";
import { ArticleCard, VerdictBadge } from "./ArticleCard";
import { ReferenceList } from "./ReferenceList";
import { RichText } from "./RichText";
import { ShareBar } from "./ShareBar";
import { withNodes } from "./withNodes";

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

/** Whether a recovered copy came from Common Crawl rather than the Internet Archive, for the credit line. */
const fromCommonCrawl = (url: string | undefined) => Boolean(url && /^https?:\/\/index\.commoncrawl\.org\//i.test(url));

function Heading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="font-display text-xl font-bold tracking-tight sm:text-2xl">
      {children}
    </h2>
  );
}

/** "Check a similar message" call to action, in the side rail and at the end of the article on phones. */
function SimilarCta({ t }: { t: SiteT }) {
  return (
    <div className="rounded-2xl border border-hairline bg-surface-raised p-5">
      <p className="font-display text-lg font-bold leading-snug">{t("art.similar.title")}</p>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{t("art.similar.body")}</p>
      <Link href="/detector" className="btn-primary mt-4 inline-flex w-full items-center justify-center gap-2 px-5 py-2.5 text-sm">
        {t("art.similar.cta")}
        <ArrowRightIcon />
      </Link>
    </div>
  );
}

/** A fact-check page; the site's own words follow the visitor's language, the archived text keeps its own. */
export async function ArticleLayout({ article, related, readingMinutes }: { article: Article; related: ArticleListItem[]; readingMinutes?: number }) {
  const { t, lang } = await getSiteT();
  const meta = VERDICT_META[article.verdict];
  const verdictLabel = t(VERDICT_LABEL[article.verdict]);
  const summary = article.summaryEn || article.summaryId;
  // The summary of an imported article is the opening of its text, so it is not repeated.
  const showSummary = summary && !norm(article.explanation).startsWith(norm(summary).slice(0, 60));
  const publisher = article.sourceSite ? sourceName(article.sourceSite) : "";
  const originalHost = hostOf(article.originalUrl);
  const date = formatDate(article.date, "long", lang);
  // Many source sites have moved or closed; their links go to the Internet Archive copy instead.
  const link = article.originalUrl ? outboundLink(article.originalUrl, article.date, article.archiveUrl) : null;
  const commonCrawl = fromCommonCrawl(article.archiveUrl);
  const linkOnly = !article.explanation && !article.narration;
  const shareText = `${verdictLabel}: ${article.title}`;
  const shareLabel = t("art.share");

  const toc = [
    article.narration && { id: "claim", label: t("art.claim") },
    article.explanation && { id: "findings", label: t("art.found") },
    article.source && { id: "circulated", label: t("art.circulated") },
    article.reference && { id: "references", label: t("art.references") },
    related.length > 0 && { id: "related", label: t("art.related") },
  ].filter((x): x is { id: string; label: string } => Boolean(x));

  const originalBox = link && (
    <div className="flex flex-col gap-3 rounded-2xl border border-hairline p-5 text-sm sm:flex-row sm:items-center sm:justify-between">
      <span className="min-w-0 text-ink-muted">
        {withNodes(t("Original source: {site}"), { site: <span className="break-all font-medium text-ink">{originalHost || article.originalUrl}</span> })}
        {link.archived && (
          <span className="block text-xs text-ink-faint">
            {commonCrawl ? t("No longer online, so this opens the Common Crawl copy.") : t("No longer online, so this opens the Internet Archive copy.")}
          </span>
        )}
      </span>
      <a href={link.href} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-1.5 font-medium text-brand hover:underline">
        {link.archived ? t("Open the archived copy") : t("Open the original")}
        <ExternalIcon />
      </a>
    </div>
  );

  return (
    <article className="container-page pb-12 sm:pb-16">
      <div className="pt-8 sm:pt-10">
        <Link href="/blog" className="inline-flex items-center gap-1.5 text-sm text-ink-muted transition-colors hover:text-ink">
          <ArrowLeftIcon className="h-3.5 w-3.5" />
          {t("art.back")}
        </Link>
      </div>

      {/* Verdict hero */}
      <header
        className="verdict-wash mt-5 overflow-hidden rounded-2xl border border-hairline p-6 sm:p-10"
        style={{ "--verdict": meta.color } as React.CSSProperties}
      >
        <div className="flex items-start justify-between gap-8">
          <div className="min-w-0 max-w-4xl">
            <div className="flex flex-wrap items-center gap-2">
              <VerdictBadge verdict={article.verdict} />
              {article.category !== meta.labelEn && (
                <span className="rounded-md bg-surface-raised/70 px-2.5 py-1 text-xs font-medium text-ink-muted">{article.category}</span>
              )}
              <span className="rounded-md bg-surface-raised/70 px-2.5 py-1 text-xs font-medium text-ink-faint">{t(LANGUAGE_LABEL[article.lang])}</span>
            </div>

            <h1 className="mt-5 break-words font-display text-3xl font-bold leading-[1.12] tracking-tight text-balance sm:text-5xl">{article.title}</h1>

            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-muted">
              {publisher && (
                <span>
                  {withNodes(t("Fact-check by {publisher}"), {
                    publisher: link ? (
                      <a href={link.href} target="_blank" rel="noopener noreferrer" className="font-medium text-ink hover:text-brand">
                        {publisher}
                      </a>
                    ) : (
                      <span className="font-medium text-ink">{publisher}</span>
                    ),
                  })}
                </span>
              )}
              {date && <span>{withNodes(t("Published {date}"), { date: <time dateTime={article.date}>{date}</time> })}</span>}
              {!linkOnly && readingMinutes ? (
                <span className="inline-flex items-center gap-1.5">
                  <ClockIcon className="h-3.5 w-3.5" />
                  {readingMinutes} {t("art.minRead")}
                </span>
              ) : null}
            </div>
            {publisher && (
              <p className="mt-2 text-xs text-ink-faint">
                {link?.archived
                  ? commonCrawl
                    ? t("The original site is no longer online; links go to the Common Crawl copy.")
                    : t("The original site is no longer online; links go to the Internet Archive copy.")
                  : t("Archived here with a link to the original.")}
              </p>
            )}
          </div>

          {/* The verdict as a stamp, on wider screens */}
          <div className="hidden shrink-0 flex-col items-center text-center md:flex" aria-hidden>
            <span
              className="grid h-20 w-20 place-items-center rounded-full font-display text-4xl font-bold shadow-neu-lg"
              style={{ background: meta.color, color: "var(--verdict-ink)" }}
            >
              {meta.emoji}
            </span>
            <span className="mt-3 font-display text-xl font-bold" style={{ color: meta.color }}>
              {verdictLabel}
            </span>
          </div>
        </div>
      </header>

      {linkOnly ? (
        /* Link-only entry: the verdict and the way to the original, nothing else to read here */
        <div className="mx-auto mt-8 max-w-3xl space-y-6">
          {article.image && (
            <div className="neu overflow-hidden p-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={article.image} alt="" className="aspect-[16/9] w-full object-cover" />
            </div>
          )}
          <div className="neu p-6 text-sm leading-relaxed text-ink-muted sm:p-8">
            <p>
              {t("Only the verdict of this fact-check is kept in our archive.")}
              {link && !link.archived && (
                <>
                  {" "}
                  {withNodes(t("The full explanation and sources are on {site}."), {
                    site: <span className="font-medium text-ink">{publisher || originalHost}</span>,
                  })}
                </>
              )}
              {link?.archived && (
                <>
                  {" "}
                  {withNodes(t("The original page on {site} is no longer online; the Internet Archive may still have a copy."), {
                    site: <span className="font-medium text-ink">{publisher || originalHost}</span>,
                  })}
                </>
              )}
            </p>
            {link && (
              <>
                <p className="mt-4 flex items-center gap-2 break-all font-mono text-xs text-ink-faint">
                  {link.archived ? <ArchiveIcon className="h-3.5 w-3.5 shrink-0" /> : <ExternalIcon className="h-3.5 w-3.5 shrink-0" />}
                  {originalHost || article.originalUrl}
                </p>
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary mt-4 inline-flex w-full items-center justify-center gap-2 px-6 py-3 text-base sm:w-auto"
                >
                  {link.archived ? t("Try the archived copy") : t("Read the full fact-check")}
                  <ExternalIcon className="h-4 w-4" />
                </a>
              </>
            )}
          </div>
          <div className="flex flex-col gap-4 rounded-2xl border border-hairline p-5 sm:flex-row sm:items-center sm:justify-between">
            <ShareBar text={shareText} url={`/blog/${article.slug}`} label={shareLabel} />
            <Link href="/detector" className="btn-primary px-5 py-2.5 text-center text-sm">
              {t("Got a similar message? Check it →")}
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_17rem] xl:gap-14">
          <div className="min-w-0 max-w-3xl space-y-10">
            {article.image && (
              <div className="neu overflow-hidden p-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={article.image} alt="" className="aspect-[16/9] w-full object-cover" />
              </div>
            )}

            {showSummary && (
              <p className="border-l-4 pl-5 font-display text-lg leading-relaxed text-ink sm:text-xl" style={{ borderColor: meta.color }}>
                {summary}
              </p>
            )}

            {article.narration && (
              <section aria-labelledby="claim" className="scroll-mt-28">
                <figure
                  className="relative overflow-hidden rounded-2xl border border-hairline bg-surface-sunken p-6 sm:p-8"
                  style={{ borderLeft: `4px solid ${meta.color}` }}
                >
                  <span aria-hidden className="pointer-events-none absolute -top-6 right-3 select-none font-display text-[8rem] leading-none opacity-10" style={{ color: meta.color }}>
                    &ldquo;
                  </span>
                  <h2 id="claim" className="eyebrow scroll-mt-28">
                    {t("art.claim")}
                  </h2>
                  <blockquote className="relative mt-3">
                    <RichText text={article.narration} size="base" className="font-display italic text-ink-muted" />
                  </blockquote>
                  {publisher && (
                    <figcaption className="relative mt-4 text-xs text-ink-faint">
                      {withNodes(t("Rated {verdict} by {publisher}."), {
                        verdict: <strong style={{ color: meta.color }}>{verdictLabel}</strong>,
                        publisher,
                      })}
                    </figcaption>
                  )}
                </figure>
              </section>
            )}

            {article.explanation && (
              <section aria-labelledby="findings" className="scroll-mt-28">
                <Heading id="findings">{t("art.found")}</Heading>
                <div className="mt-4">
                  <RichText text={article.explanation} size="base" />
                </div>
              </section>
            )}

            {article.source && (
              <section aria-labelledby="circulated" className="scroll-mt-28">
                <Heading id="circulated">{t("art.circulated")}</Heading>
                <div className="mt-4 rounded-2xl bg-surface-sunken p-5">
                  <RichText text={article.source} className="text-ink-muted" />
                </div>
              </section>
            )}

            {article.reference && (
              <section aria-labelledby="references" className="scroll-mt-28">
                <Heading id="references">{t("art.references")}</Heading>
                <div className="mt-4">
                  <ReferenceList text={article.reference} archivedNote={t("Archived copy; the original is offline")} />
                </div>
              </section>
            )}

            {originalBox}

            {/* Phones and tablets: share and the detector at the end of the article */}
            <div className="space-y-4 lg:hidden">
              <div className="rounded-2xl border border-hairline p-5">
                <ShareBar text={shareText} url={`/blog/${article.slug}`} label={shareLabel} />
              </div>
              <SimilarCta t={t} />
            </div>
          </div>

          {/* Desktop side rail */}
          <aside className="hidden lg:block" aria-label={t("Article tools")}>
            <div className="sticky top-28 space-y-4">
              {toc.length > 1 && (
                <nav aria-label={t("art.onPage")} className="rounded-2xl border border-hairline p-5">
                  <p className="meta-label">{t("art.onPage")}</p>
                  <ul className="mt-3 space-y-2 text-sm">
                    {toc.map((s) => (
                      <li key={s.id}>
                        <a href={`#${s.id}`} className="text-ink-muted transition-colors hover:text-ink">
                          {s.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </nav>
              )}
              <div className="rounded-2xl border border-hairline p-5">
                <ShareBar text={shareText} url={`/blog/${article.slug}`} label={shareLabel} />
              </div>
              <SimilarCta t={t} />
            </div>
          </aside>
        </div>
      )}

      {related.length > 0 && (
        <section aria-labelledby="related" className="mt-14 scroll-mt-28 border-t border-hairline pt-10 sm:mt-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 id="related" className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
              {t("art.related")}
            </h2>
            <Link href="/blog" className="text-sm text-ink-muted transition-colors hover:text-ink">
              {t("Browse the archive →")}
            </Link>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((r) => (
              <ArticleCard key={r.slug} article={r} />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
