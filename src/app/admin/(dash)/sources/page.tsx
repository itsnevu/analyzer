import { getCrawlQueue, listSourcesAdmin, sourceFilterFrom } from "@/lib/sources-admin";
import { SourcesTable } from "@/components/admin/SourcesTable";
import { AdminPageHeader } from "@/components/admin/AdminPage";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sources" };

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function SourcesPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const f = sourceFilterFrom((k) => one(sp[k]) || undefined);
  const sources = listSourcesAdmin(f);
  const all = listSourcesAdmin();
  const crawlQueue = getCrawlQueue();
  const active = all.filter((s) => s.active).length;
  const defaultOrder = f.sort === "site" || f.sort === "lang" ? "asc" : "desc";

  return (
    <div>
      <AdminPageHeader
        title="Sources"
        count={all.length}
        description={`The sites the old crawler collected fact-checks from, with how much of the dataset and the archive came from each; ${active} of ${all.length} are active. Legacy rows can be edited or set inactive, sites added here can be deleted.`}
      />
      <SourcesTable sources={sources} crawlQueue={crawlQueue} sort={f.sort ? { key: f.sort, order: f.order ?? defaultOrder } : undefined} />
    </div>
  );
}
