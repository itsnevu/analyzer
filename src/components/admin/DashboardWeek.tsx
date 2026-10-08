import Link from "next/link";
import { checkMatchSplit, checksPerDay, topMatchedArticles } from "@/lib/attention";
import { countBy, usageTotals } from "@/lib/usage";
import { VERDICT_META } from "@/lib/verdict";
import { adminLocale, formatAdminDay, formatAdminNumber, makeAdminT, tk, type AdminLang } from "@/lib/admin-lang";

const DAYS = 7;
const MONTH = 30;

/** Which engine answered a check, in plain words (dictionary keys). */
export const ENGINE_LABEL: Record<string, string> = {
  external: tk("External AI model"),
  baseline: tk("Model trained on our articles"),
  heuristic: tk("Simple keyword check"),
};

export interface WeekData {
  /** checks per day, the last 7 days (UTC), oldest first */
  days: { day: string; count: number }[];
  /** checks per day, the last 30 days (UTC), oldest first */
  month: { day: string; count: number }[];
  /** visitor checks in the 7 days of `days` */
  checks: number;
  visits: number;
  visitors: number;
  reports: number;
  matched: number;
  unmatched: number;
  engines: { value: string; count: number }[];
  top: ReturnType<typeof topMatchedArticles>;
}

/**
 * The research log's numbers for the dashboard; admin traffic is left out.
 * The 7 days are the last seven calendar days (UTC), today included, so the
 * chart and the totals cover the same days.
 */
export function loadWeek(): WeekData {
  const month = checksPerDay(MONTH);
  const days = month.slice(-DAYS);
  const from = days[0].day;
  const totals = usageTotals({ from });
  const split = checkMatchSplit(DAYS);
  return {
    days,
    month,
    checks: days.reduce((s, d) => s + d.count, 0),
    visits: Number(totals.visits ?? 0),
    visitors: Number(totals.visitors ?? 0),
    reports: Number(totals.reports ?? 0),
    matched: split.matched,
    unmatched: split.unmatched,
    engines: countBy("engine", { from }),
    top: topMatchedArticles(DAYS, 5),
  };
}

/** "Thu" / "Kam" for a YYYY-MM-DD day. */
function weekday(day: string, lang: AdminLang): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString(adminLocale(lang), { weekday: "short", timeZone: "UTC" });
}

/**
 * "Last 7 days" on the dashboard: one bar per day with its number written on
 * it, and three plain figures beside it. The details (30 days, engines, top
 * articles) are in WeekDetails, under "More numbers".
 */
export function DashboardWeek({ data, lang }: { data: WeekData; lang: AdminLang }) {
  const t = makeAdminT(lang);
  const n = (v: number) => formatAdminNumber(v, lang);
  const anything = data.checks + data.visits + data.reports > 0;
  const max = Math.max(1, ...data.days.map((d) => d.count));
  const answered = data.matched + data.unmatched;
  const share = answered ? Math.round((data.matched / answered) * 100) : null;

  return (
    <section className="neu p-4 sm:p-5" aria-labelledby="week-title">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div>
          <h2 id="week-title" className="font-display text-xl font-bold">
            {t("Last 7 days")}
          </h2>
          <p className="text-sm text-ink-muted">{t("How many texts visitors checked each day (days in UTC, 7 hours behind Jakarta)")}</p>
        </div>
        <Link href="/admin/research" className="inline-flex min-h-[40px] items-center text-sm font-medium text-ink-muted hover:text-ink">
          {t("See all visits and checks →")}
        </Link>
      </div>

      {!anything ? (
        <p className="mt-3 rounded-lg bg-surface-sunken px-4 py-3 text-[15px] text-ink-muted">
          {t("Nothing recorded yet. Numbers appear here as soon as people use the public website (your own visits are not counted).")}
        </p>
      ) : (
        <div className="mt-4 grid gap-5 md:grid-cols-[minmax(0,1fr)_15rem]">
          <ol
            className="flex h-44 items-end gap-2 sm:gap-3"
            aria-label={t("Checks per day for the last 7 days, {n} in total", { n: data.checks })}
          >
            {data.days.map((d, i) => {
              const last = i === data.days.length - 1;
              return (
                <li key={d.day} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
                  <span className="text-sm font-semibold tabular-nums text-ink">{n(d.count)}</span>
                  <span
                    className={last ? "w-full rounded-t-md bg-brand" : "w-full rounded-t-md bg-brand/60"}
                    style={{ height: `${d.count ? Math.max(6, (d.count / max) * 100) : 3}%`, opacity: d.count ? 1 : 0.35 }}
                    aria-hidden
                  />
                  <span className={last ? "text-center text-xs font-semibold leading-tight text-ink" : "text-center text-xs leading-tight text-ink-muted"}>
                    {weekday(d.day, lang)}
                    <span className="block text-[11px] font-normal text-ink-faint">{formatAdminDay(d.day, lang)}</span>
                  </span>
                </li>
              );
            })}
          </ol>

          <dl className="grid grid-cols-3 gap-2 md:grid-cols-1 md:content-center md:gap-3">
            <Figure label={t("Visits to the website")} value={n(data.visits)} />
            <Figure label={t("Different visitors")} value={n(data.visitors)} />
            <Figure label={t("Checks answered by one of our articles")} value={share === null ? "–" : `${share}%`} />
          </dl>
        </div>
      )}
    </section>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col-reverse rounded-lg bg-surface-sunken px-3 py-2.5">
      <dt className="mt-0.5 text-[13px] leading-snug text-ink-muted">{label}</dt>
      <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

/** The week's finer numbers, for the dashboard's "More numbers": 30 days, engines, the articles matched most. */
export function WeekDetails({ data, lang, open }: { data: WeekData; lang: AdminLang; open: number | null }) {
  const t = makeAdminT(lang);
  const n = (v: number) => formatAdminNumber(v, lang);
  const max = Math.max(1, ...data.month.map((d) => d.count));
  const engineTotal = data.engines.reduce((s, e) => s + e.count, 0);

  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <div className="neu-inset min-w-0 p-4 lg:col-span-2">
        <div className="flex items-baseline justify-between gap-3">
          <h4 className="font-semibold">{t("Checks per day, last 30 days")}</h4>
          <span className="text-xs text-ink-faint">{t("Busiest day: {n}", { n: max })}</span>
        </div>
        <div className="mt-4 flex h-28 items-end gap-[3px]" role="img" aria-label={t("Checks per day over the last 30 days, at most {n} a day", { n: max })}>
          {data.month.map((d) => (
            <div key={d.day} className="group relative flex h-full flex-1 items-end" title={`${formatAdminDay(d.day, lang)}: ${n(d.count)}`}>
              <div
                className="w-full rounded-t bg-brand/80 transition-colors group-hover:bg-brand"
                style={{ height: `${d.count ? Math.max(4, (d.count / max) * 100) : 2}%`, opacity: d.count ? 1 : 0.25 }}
              />
            </div>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-xs text-ink-faint">
          <span>{formatAdminDay(data.month[0].day, lang)}</span>
          <span>{formatAdminDay(data.month[data.month.length - 1].day, lang)}</span>
        </div>
      </div>

      <div className="neu-inset min-w-0 p-4">
        <h4 className="font-semibold">{t("Which engine answered (7 days)")}</h4>
        <ul className="mt-3 space-y-2 text-sm">
          {data.engines.length === 0 && <li className="text-ink-faint">{t("No checks this week.")}</li>}
          {data.engines.map((e) => (
            <li key={e.value}>
              <div className="flex justify-between gap-2">
                <span>{ENGINE_LABEL[e.value] ? t(ENGINE_LABEL[e.value]) : e.value}</span>
                <span className="tabular-nums text-ink-muted">{n(e.count)}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-raised">
                <div className="h-full rounded-full bg-brand" style={{ width: `${(e.count / Math.max(1, engineTotal)) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-1.5 border-t border-hairline pt-3 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-ink-muted">{t("Checks with a matching article")}</dt>
            <dd className="tabular-nums">{n(data.matched)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-ink-muted">{t("Checks without one")}</dt>
            <dd className="tabular-nums">{n(data.unmatched)}</dd>
          </div>
        </dl>
        {open !== null && (
          <Link
            href="/admin/attention"
            className="mt-3 flex min-h-[40px] items-center justify-between rounded-lg bg-verdict-warn/10 px-3 text-sm font-medium text-verdict-warn hover:bg-verdict-warn/15"
          >
            <span>{t("Needs attention")}</span>
            <span className="tabular-nums">{t("{n} open →", { n: open })}</span>
          </Link>
        )}
      </div>

      {data.top.length > 0 && (
        <div className="neu-inset min-w-0 p-4 lg:col-span-3">
          <h4 className="font-semibold">{t("Articles the detector pointed to most (7 days)")}</h4>
          <ol className="mt-2 divide-y divide-hairline">
            {data.top.map((a) => (
              <li key={a.slug} className="flex items-center gap-3 py-2 text-sm">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: VERDICT_META[a.verdict].color }} aria-hidden />
                <Link href={`/admin/articles/${a.slug}/edit`} className="min-w-0 flex-1 truncate hover:text-brand" title={a.title}>
                  {a.title}
                </Link>
                <span className="shrink-0 tabular-nums text-ink-muted">{n(a.count)}×</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
