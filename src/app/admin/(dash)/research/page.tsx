import { MonthlyColumns } from "@/components/admin/charts/MonthlyColumns";
import { BREAKDOWNS, checksByHour, checksByMonth, countBy, recentUsage, retentionDays, usageTotals, type Breakdown, type UsageFilter } from "@/lib/usage";

export const metadata = { title: "Research data" };

const n = (v: unknown) => Number(v ?? 0).toLocaleString("en-US");
const wib = (iso: string) => new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" });

export default async function ResearchPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  const date = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined);
  const f: UsageFilter = {
    from: date(q.from),
    to: date(q.to),
    origin: q.origin === "site" || q.origin === "legacy" ? q.origin : "",
    staff: q.staff === "1",
  };
  const t = usageTotals(f);
  const hours = checksByHour(f);
  const maxHour = Math.max(...hours, 1);
  const qs = new URLSearchParams(Object.entries({ from: f.from, to: f.to, origin: f.origin, staff: f.staff ? "1" : "" }).filter(([, v]) => v) as [string, string][]);

  return (
    <div className="space-y-4">
      <div className="neu p-6">
        <p className="eyebrow">Research</p>
        <h1 className="font-display text-3xl font-bold">How the site is used</h1>
        <p className="mt-2 max-w-3xl text-sm text-ink-muted">
          Every visit, check, report and self-reported role, with network and device. &quot;Legacy&quot; rows are the old panel&apos;s search log
          (April 2019 – February 2024). Networks are looked up from today&apos;s registry, so old addresses may have changed owner.
          IP addresses are kept {retentionDays() ? `${retentionDays()} days` : "without a limit"}. For a paper, use the anonymized export and report totals only.
        </p>
        <form className="mt-4 flex flex-wrap items-end gap-3 text-xs">
          <label>From <input type="date" name="from" defaultValue={f.from} className="ml-1 rounded border border-hairline px-2 py-1" /></label>
          <label>To <input type="date" name="to" defaultValue={f.to} className="ml-1 rounded border border-hairline px-2 py-1" /></label>
          <select name="origin" defaultValue={f.origin} className="rounded border border-hairline px-2 py-1">
            <option value="">This site + legacy</option>
            <option value="site">This site</option>
            <option value="legacy">Legacy log</option>
          </select>
          <label><input type="checkbox" name="staff" value="1" defaultChecked={f.staff} /> Include admin&apos;s own use</label>
          <button className="neu-btn px-3 py-1.5">Apply</button>
          <a href={`/api/admin/research/export?${qs}&anonymized=1`} className="btn-primary px-3 py-1.5">Export CSV (anonymized)</a>
          <a href={`/api/admin/research/export?${qs}`} className="neu-btn px-3 py-1.5">Export CSV (full, with IP)</a>
        </form>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          ["Checks", t.checks], ["Visits", t.visits], ["Reports & messages", t.reports],
          ["Browsers", t.visitors], ["Distinct IP addresses", t.networks], ["Rows still with IP", t.withIp],
        ].map(([label, v]) => (
          <div key={String(label)} className="neu p-4">
            <div className="text-2xl font-semibold tabular-nums">{n(v)}</div>
            <div className="text-xs text-ink-muted">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="neu p-5 lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold">Checks per month</h2>
          <MonthlyColumns points={checksByMonth(f)} />
        </div>
        <div className="neu p-5">
          <h2 className="mb-3 text-sm font-semibold">Checks by hour (WIB)</h2>
          <div className="flex h-40 items-end gap-0.5">
            {hours.map((v, h) => (
              <div key={h} title={`${h}:00 — ${v}`} className="flex-1 rounded-t bg-brand" style={{ height: `${(v / maxHour) * 100}%` }} />
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-ink-faint"><span>00</span><span>12</span><span>23</span></div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {(Object.keys(BREAKDOWNS) as Breakdown[]).map((col) => {
          const rows = countBy(col, f);
          if (!rows.length) return null;
          const max = rows[0].count;
          return (
            <div key={col} className="neu p-5">
              <h2 className="mb-3 text-sm font-semibold">{BREAKDOWNS[col]}</h2>
              <ul className="space-y-1 text-xs">
                {rows.map((r) => (
                  <li key={r.value} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                    <span className="relative truncate" title={r.value}>
                      <span className="absolute inset-y-0 left-0 rounded bg-brand/15" style={{ width: `${(r.count / max) * 100}%` }} />
                      <span className="relative px-1">{r.value}</span>
                    </span>
                    <span className="tabular-nums text-ink-muted">{n(r.count)}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <div className="neu overflow-x-auto p-5">
        <h2 className="mb-3 text-sm font-semibold">Latest activity</h2>
        <table className="w-full text-left text-xs">
          <thead className="text-ink-faint">
            <tr>{["Time (WIB)", "Kind", "IP", "Network", "Device", "Role", "Text", "Result"].map((h) => <th key={h} className="pb-2 pr-3 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody>
            {recentUsage(f).map((r) => (
              <tr key={Number(r.id)} className="border-t border-hairline align-top">
                <td className="whitespace-nowrap py-1.5 pr-3">{wib(String(r.at))}</td>
                <td className="pr-3">{r.kind}{r.origin === "legacy" ? " (legacy)" : ""}</td>
                <td className="pr-3 font-mono">{r.ip ?? "—"}</td>
                <td className="max-w-48 truncate pr-3" title={String(r.asOrg)}>{r.asOrg}{r.country ? ` · ${r.country}` : ""}</td>
                <td className="pr-3">{[r.device, r.os, r.inApp || r.browser].filter(Boolean).join(" · ")}</td>
                <td className="pr-3">{[r.role, r.organization].filter(Boolean).join(", ")}</td>
                <td className="max-w-72 truncate pr-3" title={String(r.text)}>{r.text}</td>
                <td>{r.error || r.verdict}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
