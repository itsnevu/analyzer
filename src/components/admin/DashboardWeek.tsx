import Link from "next/link";
import { checkMatchSplit, checksPerDay, countOpenAttention, topMatchedArticles } from "@/lib/attention";
import { countBy, usageTotals } from "@/lib/usage";
import { VERDICT_META } from "@/lib/verdict";
import { formatCount } from "@/lib/sources";
import { StatTile } from "./AdminPage";

const DAYS = 7;
const ENGINE_LABEL: Record<string, string> = { external: "External model", baseline: "Trained classifier", heuristic: "Keyword heuristic" };

const n = (v: unknown) => formatCount(Number(v ?? 0));
/** The date `days` days ago (UTC, YYYY-MM-DD); a server-side read of the clock, outside render. */
function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

const dayLabel = (day: string) => new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/**
 * "Last 7 days" on the dashboard: what visitors did, which engine answered,
 * how often the archive had the answer, and the claims it did not have.
 * Everything comes from the research log; admin traffic is left out.
 */
export function DashboardWeek() {
  const from = daysAgo(DAYS);
  const totals = usageTotals({ from });
  const engines = countBy("engine", { from });
  const split = checkMatchSplit(DAYS);
  const top = topMatchedArticles(DAYS, 5);
  const perDay = checksPerDay(30);
  const open = countOpenAttention(30);
  const checks = Number(totals.checks ?? 0);
  const anything = checks + Number(totals.visits ?? 0) + Number(totals.reports ?? 0) > 0;
  const maxDay = Math.max(1, ...perDay.map((d) => d.count));
  const matchedShare = checks ? Math.round((split.matched / Math.max(1, split.matched + split.unmatched)) * 100) : 0;

  return (
    <section className="space-y-3" aria-labelledby="week-title">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <span className="eyebrow">Activity</span>
          <h2 id="week-title" className="mt-1.5 font-display text-xl font-bold">
            Last {DAYS} days
          </h2>
        </div>
        <Link href="/admin/research" className="text-sm text-ink-muted hover:text-ink">
          Full research log →
        </Link>
      </div>

      {!anything ? (
        <div className="neu p-6 text-sm text-ink-muted">
          No usage recorded yet. Visits and checks appear here as soon as people use the public site (admin traffic is not counted).
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatTile label="Checks" value={n(totals.checks)} tone="brand" note={checks ? `${matchedShare}% answered by the archive` : undefined} />
            <StatTile label="Visits" value={n(totals.visits)} />
            <StatTile label="Reports & messages" value={n(totals.reports)} tone={Number(totals.reports) ? "warn" : undefined} href="/admin/reports" />
            <StatTile label="Browsers" value={n(totals.visitors)} note={`${n(totals.networks)} networks`} />
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <div className="neu min-w-0 p-5 lg:col-span-2">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-semibold">Checks per day</h3>
                <span className="text-xs text-ink-faint">last 30 days, UTC</span>
              </div>
              <div className="mt-4 flex h-32 items-end gap-[3px]" role="img" aria-label={`Checks per day over the last 30 days, at most ${maxDay} a day`}>
                {perDay.map((d) => (
                  <div key={d.day} className="group relative flex h-full flex-1 items-end">
                    <div
                      className="w-full rounded-t bg-brand/80 transition-colors group-hover:bg-brand"
                      style={{ height: `${d.count ? Math.max(4, (d.count / maxDay) * 100) : 2}%`, opacity: d.count ? 1 : 0.25 }}
                    />
                    <span className="pointer-events-none absolute -top-7 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-ink px-1.5 py-0.5 text-[10px] text-surface-raised group-hover:block">
                      {dayLabel(d.day)}: {d.count}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-ink-faint">
                <span>{dayLabel(perDay[0].day)}</span>
                <span>{dayLabel(perDay[perDay.length - 1].day)}</span>
              </div>
            </div>

            <div className="neu min-w-0 p-5">
              <h3 className="font-semibold">Who answered</h3>
              <ul className="mt-3 space-y-2 text-sm">
                {engines.length === 0 && <li className="text-ink-faint">No checks this week.</li>}
                {engines.map((e) => (
                  <li key={e.value}>
                    <div className="flex justify-between gap-2">
                      <span>{ENGINE_LABEL[e.value] ?? e.value}</span>
                      <span className="tabular-nums text-ink-muted">{n(e.count)}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-sunken">
                      <div className="h-full rounded-full bg-brand" style={{ width: `${(e.count / Math.max(1, checks)) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
              <dl className="mt-4 space-y-1.5 border-t border-hairline pt-3 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-muted">With an archive match</dt>
                  <dd className="tabular-nums">{n(split.matched)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-muted">Without one</dt>
                  <dd className="tabular-nums">{n(split.unmatched)}</dd>
                </div>
              </dl>
              <Link href="/admin/attention" className="mt-4 flex items-center justify-between rounded-lg bg-verdict-warn/10 px-3 py-2 text-sm font-medium text-verdict-warn hover:bg-verdict-warn/15">
                <span>Needs attention</span>
                <span className="tabular-nums">{n(open)} open →</span>
              </Link>
            </div>
          </div>

          {top.length > 0 && (
            <div className="neu p-5">
              <h3 className="font-semibold">Fact-checks the detector answered with most</h3>
              <ol className="mt-3 divide-y divide-hairline">
                {top.map((a) => (
                  <li key={a.slug} className="flex items-center gap-3 py-2 text-sm">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: VERDICT_META[a.verdict].color }} aria-hidden />
                    <Link href={`/admin/articles/${a.slug}/edit`} className="min-w-0 flex-1 truncate hover:text-brand" title={a.title}>
                      {a.title}
                    </Link>
                    <span className="shrink-0 tabular-nums text-ink-muted">{n(a.count)}×</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </>
      )}
    </section>
  );
}
