import { DATASET_LABELS, datasetFilterFrom, getDatasetSourceOptions, getDatasetYears, listDataset } from "@/lib/dataset-admin";
import { getDatasetOverview } from "@/lib/legacy-panel";
import { DatasetTable } from "@/components/admin/DatasetTable";
import { AdminPageHeader, AdminTab } from "@/components/admin/AdminPage";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dataset" };

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function DatasetPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const f = datasetFilterFrom((k) => one(sp[k]) || undefined);
  const result = listDataset(f);
  const overview = getDatasetOverview();
  // Spread: node:sqlite rows have a null prototype, which cannot cross into a client component.
  const sources = getDatasetSourceOptions().map((s) => ({ ...s }));
  const years = getDatasetYears();

  // The current URL without the page number, for the tabs and the CSV export.
  const current = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (one(v) && k !== "page") current.set(k, one(v));
  const tabHref = (tab: "categorized" | "uncategorized") => {
    const p = new URLSearchParams(current);
    p.delete("label");
    if (tab === "categorized") p.delete("tab");
    else p.set("tab", tab);
    const s = p.toString();
    return s ? `/admin/dataset?${s}` : "/admin/dataset";
  };
  const exportQuery = new URLSearchParams(current);
  exportQuery.delete("pageSize");

  return (
    <div>
      <AdminPageHeader
        title="Dataset"
        count={overview.labeled + overview.unlabeled}
        description="The old detector's training data and the label each page was given. A label changed here wins over the imported one; “Add to archive” turns a row into a fact-check entry, hidden when its label gives no verdict."
        tabs={
          <>
            <AdminTab href={tabHref("categorized")} active={f.tab !== "uncategorized"} count={overview.labeled}>
              Categorized
            </AdminTab>
            <AdminTab href={tabHref("uncategorized")} active={f.tab === "uncategorized"} count={overview.unlabeled}>
              Uncategorized
            </AdminTab>
          </>
        }
      />
      <DatasetTable
        items={result.items}
        labels={[...DATASET_LABELS]}
        tab={f.tab ?? "categorized"}
        sources={sources}
        years={years}
        paging={{ page: result.page, pages: result.pages, total: result.total, pageSize: result.pageSize }}
        sort={{ key: f.sort ?? "date", order: f.order ?? "desc" }}
        exportHref={`/api/admin/dataset/export?${exportQuery.toString()}`}
      />
    </div>
  );
}
