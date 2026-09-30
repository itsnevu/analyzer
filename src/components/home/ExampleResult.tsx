import Link from "next/link";
import { findSimilarArticles } from "@/lib/articles";
import { VERDICT_META } from "@/lib/verdict";
import { formatDate, sourceName } from "@/lib/sources";
import { SectionHeading } from "@/components/ui/Neu";
import { VerdictBadge } from "@/components/article/ArticleCard";

/** A typical forwarded message; the matching fact-check is looked up live in the archive. */
const SAMPLE =
  "Hati-hati! Setelah divaksin covid, lengan jadi magnet dan tubuh bisa terkoneksi ke bluetooth HP. Sudah dibuktikan banyak orang. Sebarkan ke keluarga dan grup!";

/** Shows what the detector does with a real example, instead of describing it. */
export async function ExampleResult() {
  const [match] = await findSimilarArticles(SAMPLE, 1).catch(() => []);
  if (!match) return null;
  const meta = VERDICT_META[match.verdict];

  return (
    <section className="container-page py-16">
      <SectionHeading
        eyebrow="See it work"
        title="A forwarded message, checked in seconds."
        intro="Most hoaxes that reach your family group have been debunked before. The detector finds the fact-check for you."
      />

      <div className="mt-10 grid items-stretch gap-4 lg:grid-cols-[1fr_auto_1.1fr]">
        {/* The message, as it arrives */}
        <div className="neu flex flex-col justify-center p-6">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-faint">Forwarded many times</div>
          <p className="mt-3 max-w-md rounded-2xl rounded-tl-sm bg-[#e7ffdb] px-4 py-3 text-sm leading-relaxed text-[#111b21] shadow-sm">
            {SAMPLE}
          </p>
        </div>

        <div className="hidden items-center justify-center text-2xl text-ink-faint lg:flex" aria-hidden>
          →
        </div>

        {/* What the archive says */}
        <div className="neu overflow-hidden p-0">
          <div
            className="flex items-center gap-4 p-6"
            style={{ background: `linear-gradient(120deg, color-mix(in srgb, ${meta.color} 14%, transparent), transparent)` }}
          >
            <div className="font-display text-3xl font-bold" style={{ color: meta.color }}>
              {meta.labelEn}
            </div>
            <div className="text-sm text-ink-muted">This claim was already fact-checked.</div>
          </div>
          <div className="space-y-3 p-6 pt-4">
            <div className="flex items-start gap-3">
              <VerdictBadge verdict={match.verdict} className="mt-0.5 shrink-0" />
              <div className="min-w-0">
                <div className="font-medium leading-snug text-ink">{match.title}</div>
                <div className="mt-1 text-xs text-ink-faint">
                  {[match.sourceSite && sourceName(match.sourceSite), formatDate(match.date)].filter(Boolean).join(" · ")}
                </div>
              </div>
            </div>
            {match.summary && <p className="line-clamp-3 text-sm leading-relaxed text-ink-muted">{match.summary}</p>}
            <div className="flex flex-wrap gap-2 pt-2">
              <Link href={`/blog/${match.slug}`} className="neu-btn px-4 py-2 text-sm">
                Read the fact-check
              </Link>
              <Link href={`/detector?text=${encodeURIComponent(SAMPLE)}`} className="btn-primary px-4 py-2 text-sm">
                Run this example →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
