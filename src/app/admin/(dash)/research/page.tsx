import type { Metadata } from "next";
import { MonthlyColumns } from "@/components/admin/charts/MonthlyColumns";
import { BREAKDOWNS, checksByHour, checksByMonth, countBy, recentUsage, retentionDays, usageTotals, type Breakdown, type UsageFilter } from "@/lib/usage";
import { formatAdminDateTime, formatAdminNumber, tk, type AdminT } from "@/lib/admin-lang";
import { getAdminT } from "@/lib/admin-lang-server";
import { VERDICT_META } from "@/lib/verdict";
import { requireAdmin } from "@/lib/require-admin";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAdminT();
  return { title: t("Research log") };
}

/** Plain names for the kinds of rows in the usage log. */
const KIND_NAME: Record<string, string> = {
  visit: tk("Visit"),
  check: tk("Check"),
  report: tk("Report"),
  contact: tk("Message"),
  profile: tk("Role given"),
};

/** A stored verdict key ("hoax", "valid"…) in the panel language; anything else as it is. */
const verdictText = (v: unknown, t: AdminT) => {
  const key = String(v ?? "");
  return key in VERDICT_META ? t(VERDICT_META[key as keyof typeof VERDICT_META].label) : key;
};

const field = "ml-1 rounded border border-hairline bg-surface-sunken px-2 py-1.5 text-sm";

export default async function ResearchPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const { t, lang } = await getAdminT();
  const n = (v: unknown) => formatAdminNumber(Number(v ?? 0), lang);
  const q = await searchParams;
  const date = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined);
  const f: UsageFilter = {
    from: date(q.from),
    to: date(q.to),
    origin: q.origin === "site" || q.origin === "legacy" ? q.origin : "",
    staff: q.staff === "1",
  };
  const totals = usageTotals(f);
  const hours = checksByHour(f);
  const maxHour = Math.max(...hours, 1);
  const qs = new URLSearchParams(Object.entries({ from: f.from, to: f.to, origin: f.origin, staff: f.staff ? "1" : "" }).filter(([, v]) => v) as [string, string][]);
  const keepDays = retentionDays();

  const tiles: [string, unknown][] = [
    [t("Checks"), totals.checks],
    [t("Visits"), totals.visits],
    [t("Reports & messages"), totals.reports],
    [t("Visitors (browsers)"), totals.visitors],
    [t("Different IP addresses"), totals.networks],
    [t("Rows still holding an IP"), totals.withIp],
  ];

  return (
    <div className="space-y-4">
      <div className="neu p-6">
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-[1.75rem]">{t("Research log")}</h1>
        <p className="mt-2 max-w-3xl text-sm text-ink-muted">
          {t(
            "How people use the site: every visit, check and report, with the visitor's network, device and the role they gave. “Old log” rows are the old panel's search log (April 2019 – February 2024). Network names come from today's registry, so old addresses may have changed owner.",
          )}{" "}
          {keepDays ? t("IP addresses are kept for {n} days.", { n: keepDays }) : t("IP addresses are kept without a time limit.")}{" "}
          {t("For a paper, use the export without IP addresses and report totals only.")}
        </p>
        <form className="mt-4 flex flex-wrap items-end gap-3 text-sm">
          <label>
            {t("From")} <input type="date" name="from" defaultValue={f.from} className={field} />
          </label>
          <label>
            {t("To")} <input type="date" name="to" defaultValue={f.to} className={field} />
          </label>
          <select name="origin" defaultValue={f.origin} aria-label={t("Where from")} className="rounded border border-hairline bg-surface-sunken px-2 py-1.5 text-sm">
            <option value="">{t("This site + old log")}</option>
            <option value="site">{t("This site")}</option>
            <option value="legacy">{t("Old panel log")}</option>
          </select>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" name="staff" value="1" defaultChecked={f.staff} className="h-4 w-4 accent-brand" /> {t("Include the admin's own use")}
          </label>
          <button className="neu-btn px-4 py-2">{t("Apply")}</button>
          <a href={`/api/admin/research/export?${qs}&anonymized=1`} className="btn-primary px-4 py-2">
            {t("Export CSV (without IP addresses)")}
          </a>
          <a href={`/api/admin/research/export?${qs}`} className="neu-btn px-4 py-2">
            {t("Export CSV (full, with IP addresses)")}
          </a>
        </form>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {tiles.map(([label, v]) => (
          <div key={label} className="neu p-4">
            <div className="text-2xl font-semibold tabular-nums">{n(v)}</div>
            <div className="text-sm text-ink-muted">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="neu p-5 lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold">{t("Checks per month")}</h2>
          <MonthlyColumns points={checksByMonth(f)} />
        </div>
        <div className="neu p-5">
          <h2 className="mb-3 text-sm font-semibold">{t("Checks by hour of the day (WIB)")}</h2>
          <div className="flex h-40 items-end gap-0.5">
            {hours.map((v, h) => (
              <div key={h} title={`${h}:00 — ${n(v)}`} className="flex-1 rounded-t bg-brand" style={{ height: `${(v / maxHour) * 100}%` }} />
            ))}
          </div>
          <div className="mt-1 flex justify-between text-xs text-ink-faint">
            <span>00</span>
            <span>12</span>
            <span>23</span>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {(Object.keys(BREAKDOWNS) as Breakdown[]).map((col) => {
          const rows = countBy(col, f);
          if (!rows.length) return null;
          const max = rows[0].count;
          return (
            <div key={col} className="neu p-5">
              <h2 className="mb-3 text-sm font-semibold">{t(BREAKDOWNS[col])}</h2>
              <ul className="space-y-1 text-sm">
                {rows.map((r) => {
                  const value = col === "verdict" ? verdictText(r.value, t) : r.value;
                  return (
                    <li key={r.value} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                      <span className="relative truncate" title={r.value}>
                        <span className="absolute inset-y-0 left-0 rounded bg-brand/15" style={{ width: `${(r.count / max) * 100}%` }} />
                        <span className="relative px-1">{value}</span>
                      </span>
                      <span className="tabular-nums text-ink-muted">{n(r.count)}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

      <div className="neu overflow-x-auto p-5">
        <h2 className="mb-3 text-sm font-semibold">{t("Latest activity")}</h2>
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-ink-faint">
            <tr>
              {[t("Time (WIB)"), t("What"), "IP", t("Network"), t("Device"), t("Role"), t("Text"), t("Result")].map((h) => (
                <th key={h} className="pb-2 pr-3 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {recentUsage(f).map((r) => (
              <tr key={Number(r.id)} className="border-t border-hairline align-top">
                <td className="whitespace-nowrap py-1.5 pr-3">{formatAdminDateTime(String(r.at), lang)}</td>
                <td className="whitespace-nowrap pr-3">
                  {KIND_NAME[String(r.kind)] ? t(KIND_NAME[String(r.kind)]) : r.kind}
                  {r.origin === "legacy" ? ` ${t("(old log)")}` : ""}
                </td>
                <td className="pr-3 font-mono text-xs">{r.ip ?? "—"}</td>
                <td className="max-w-48 truncate pr-3" title={String(r.asOrg)}>
                  {r.asOrg}
                  {r.country ? ` · ${r.country}` : ""}
                </td>
                <td className="pr-3">{[r.device, r.os, r.inApp || r.browser].filter(Boolean).join(" · ")}</td>
                <td className="pr-3">{[r.role, r.organization].filter(Boolean).join(", ")}</td>
                <td className="max-w-72 truncate pr-3" title={String(r.text)}>
                  {r.text}
                </td>
                <td>{r.error || verdictText(r.verdict, t)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
