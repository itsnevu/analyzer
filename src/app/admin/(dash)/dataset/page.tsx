import Link from "next/link";
import { DATASET_LABELS, datasetFilterFrom, getDatasetSourceOptions, getDatasetYears, listDataset } from "@/lib/dataset-admin";
import { getDatasetOverview } from "@/lib/legacy-panel";
import { DatasetTable } from "@/components/admin/DatasetTable";
import { Pagination } from "@/components/ui/Pagination";
import { formatCount } from "@/lib/sources";
import { clsx } from "@/lib/clsx";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dataset" };

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

const LABEL_NAME: Record<string, string> = {
  HOAX: "Hoax", DISINFORMATION: "Disinformation", INFORMATION: "Information", FACT: "Fact",
  EDUKASI: "Education", KLARIFIKASI: "Clarification", UNKNOWN: "Unknown",
};

const field = "rounded-lg border border-hairline bg-surface-sunken px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-brand/30";

export default async function DatasetPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const f = datasetFilterFrom((k) => one(sp[k]) || undefined);
  const result = listDataset(f);
  const overview = getDatasetOverview();
  const sources = getDatasetSourceOptions();
  const years = getDatasetYears();

  // The current filter as query parameters; `changes` overrides single keys.
  const query = (changes: Partial<Record<"tab" | "label" | "q" | "source" | "year" | "archived" | "page", string | number>> = {}) => {
    const p = new URLSearchParams();
    const tab = String(changes.tab ?? f.tab);
    if (tab !== "categorized") p.set("tab", tab);
    const put = (key: "label" | "q" | "source" | "year" | "archived", current: string | number | undefined) => {
      const v = changes[key] ?? current;
      if (v) p.set(key, String(v));
    };
    if (tab === "categorized") put("label", f.label);
    put("q", f.q);
    put("source", f.source);
    put("year", f.year);
    put("archived", f.archived);
    if (changes.page && Number(changes.page) > 1) p.set("page", String(changes.page));
    return p.toString();
  };
  const href = (changes: Parameters<typeof query>[0] = {}) => {
    const s = query(changes);
    return s ? `/admin/dataset?${s}` : "/admin/dataset";
  };

  const first = result.total ? (result.page - 1) * result.pageSize + 1 : 0;
  const last = Math.min(result.page * result.pageSize, result.total);
  const tabs = [
    { key: "categorized", label: "Categorized", count: overview.labeled },
    { key: "uncategorized", label: "Uncategorized", count: overview.unlabeled },
  ] as const;

  return (
    <div className="space-y-4">
      <div className="neu p-6">
        <span className="eyebrow">Data</span>
        <h1 className="mt-2 font-display text-2xl font-bold">Dataset ({formatCount(overview.labeled + overview.unlabeled)})</h1>
        <p className="mt-2 max-w-3xl text-sm text-ink-muted">
          The old detector&apos;s training data: every page its crawler collected, with the label it was given. A label changed here
          wins over the imported one and counts in the dashboard. &quot;Add to archive&quot; makes a fact-check entry from a row the same
          way the import did; rows whose label gives no verdict become hidden entries for review.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={href({ tab: t.key, page: 1 })}
            className={clsx(
              "rounded-full px-3.5 py-2 text-sm font-medium transition-colors",
              f.tab === t.key ? "bg-ink text-surface-raised" : "text-ink-muted hover:bg-surface-sunken hover:text-ink",
            )}
          >
            {t.label} <span className="opacity-70">({formatCount(t.count)})</span>
          </Link>
        ))}
      </div>

      <form action="/admin/dataset" method="get" className="neu flex flex-wrap items-center gap-2 p-3 text-sm">
        {f.tab !== "categorized" && <input type="hidden" name="tab" value={f.tab} />}
        {f.tab === "categorized" && (
          <select name="label" defaultValue={f.label} className={field} aria-label="Label">
            <option value="">All labels</option>
            {DATASET_LABELS.map((l) => (
              <option key={l} value={l}>{LABEL_NAME[l]} ({l})</option>
            ))}
          </select>
        )}
        <input type="search" name="q" defaultValue={f.q} placeholder="Search title…" className={clsx(field, "min-w-48 flex-1")} />
        <select name="source" defaultValue={f.source ?? ""} className={field} aria-label="Source site">
          <option value="">All sites</option>
          {sources.map((s) => (
            <option key={s.id} value={s.id}>{s.site} ({formatCount(s.count)})</option>
          ))}
        </select>
        <select name="year" defaultValue={f.year} className={field} aria-label="Year">
          <option value="">Any year</option>
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <select name="archived" defaultValue={f.archived} className={field} aria-label="Archive status">
          <option value="">In archive or not</option>
          <option value="yes">In the archive</option>
          <option value="no">Not in the archive</option>
        </select>
        <button type="submit" className="neu-btn px-4 py-2">Apply</button>
        <a href={`/api/admin/dataset/export?${query()}`} className="btn-primary px-4 py-2 text-sm">Export CSV</a>
      </form>

      <p className="text-xs text-ink-muted">
        View {formatCount(first)}–{formatCount(last)} of {formatCount(result.total)}
      </p>

      <DatasetTable items={result.items} labels={[...DATASET_LABELS]} />
      <Pagination page={result.page} pages={result.pages} hrefFor={(p) => href({ page: p })} />
    </div>
  );
}
