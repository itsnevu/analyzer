import Link from "next/link";
import { getSearchOverview, listSearches, searchFilterFrom } from "@/lib/searches";
import { SearchesTable } from "@/components/admin/SearchesTable";
import { Pagination } from "@/components/ui/Pagination";
import { formatCount } from "@/lib/sources";

export const dynamic = "force-dynamic";
export const metadata = { title: "Searches" };

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const field = "rounded-lg border border-hairline bg-surface-sunken px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-brand/30";

/** Site rows are stored in UTC; legacy rows already carry the old server's WIB time. */
function wib(createdAt: string, origin: string): string {
  const d = origin === "legacy" ? new Date(`${createdAt.replace(" ", "T")}+07:00`) : new Date(`${createdAt.replace(" ", "T")}Z`);
  if (Number.isNaN(d.getTime())) return createdAt;
  return d.toLocaleString("en-GB", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" });
}

export default async function SearchesPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const f = searchFilterFrom((k) => one(sp[k]) || undefined);
  const result = listSearches(f);
  const overview = getSearchOverview();

  const query = (changes: { page?: number } = {}) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ q: f.q, from: f.from, to: f.to, origin: f.origin, verdict: f.verdict })) if (v) p.set(k, v);
    if (changes.page && changes.page > 1) p.set("page", String(changes.page));
    return p.toString();
  };
  const href = (changes: { page?: number } = {}) => {
    const s = query(changes);
    return s ? `/admin/searches?${s}` : "/admin/searches";
  };
  const first = result.total ? (result.page - 1) * result.pageSize + 1 : 0;
  const last = Math.min(result.page * result.pageSize, result.total);
  const items = result.items.map((r) => ({ ...r, when: wib(r.createdAt, r.origin) }));
  const day = (iso: string | null) => (iso ? iso.slice(0, 10) : "—");

  return (
    <div className="space-y-4">
      <div className="neu p-6">
        <span className="eyebrow">Detector</span>
        <h1 className="mt-2 font-display text-2xl font-bold">Searches ({formatCount(overview.total)})</h1>
        <p className="mt-2 max-w-3xl text-sm text-ink-muted">
          Everything submitted to the detector: the old panel&apos;s log (April 2019 – February 2024) and checks made on this site, with
          the verdict given. No IP addresses are kept here; for network, device and role data see the{" "}
          <Link href="/admin/research" className="text-brand hover:underline">research log</Link>.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          ["Searches", formatCount(overview.total)],
          ["Distinct texts", formatCount(overview.distinct)],
          ["Pasted links", formatCount(overview.links)],
          ["From this site", formatCount(overview.fromSite)],
          ["First", day(overview.first)],
          ["Latest", day(overview.last)],
        ].map(([label, value]) => (
          <div key={label} className="neu p-4">
            <div className="text-2xl font-semibold tabular-nums">{value}</div>
            <div className="text-xs text-ink-muted">{label}</div>
          </div>
        ))}
      </div>

      <form action="/admin/searches" method="get" className="neu flex flex-wrap items-center gap-2 p-3 text-sm">
        <input type="search" name="q" defaultValue={f.q} placeholder="Keyword…" className={`${field} min-w-48 flex-1`} />
        <label className="text-xs text-ink-muted">From <input type="date" name="from" defaultValue={f.from} className={`${field} ml-1`} /></label>
        <label className="text-xs text-ink-muted">To <input type="date" name="to" defaultValue={f.to} className={`${field} ml-1`} /></label>
        <select name="origin" defaultValue={f.origin} className={field} aria-label="Origin">
          <option value="">This site + legacy</option>
          <option value="site">This site</option>
          <option value="legacy">Legacy log</option>
        </select>
        <select name="verdict" defaultValue={f.verdict} className={field} aria-label="Verdict">
          <option value="">Any verdict</option>
          <option value="hoax">Hoax</option>
          <option value="misleading">Misleading</option>
          <option value="valid">Credible</option>
          <option value="none">No verdict (legacy)</option>
        </select>
        <button type="submit" className="neu-btn px-4 py-2">Apply</button>
        <a href={`/api/admin/searches/export?${query()}`} className="btn-primary px-4 py-2 text-sm">Export CSV</a>
      </form>

      <p className="text-xs text-ink-muted">
        View {formatCount(first)}–{formatCount(last)} of {formatCount(result.total)}
      </p>

      <SearchesTable items={items} />
      <Pagination page={result.page} pages={result.pages} hrefFor={(p) => href({ page: p })} />
    </div>
  );
}
