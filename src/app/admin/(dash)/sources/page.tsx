import { getCrawlQueue, listSourcesAdmin } from "@/lib/sources-admin";
import { SourcesTable } from "@/components/admin/SourcesTable";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sources" };

export default async function SourcesPage() {
  const sources = listSourcesAdmin();
  const crawlQueue = getCrawlQueue();
  const active = sources.filter((s) => s.active).length;

  return (
    <div className="space-y-4">
      <div className="neu p-6">
        <span className="eyebrow">Data</span>
        <h1 className="mt-2 font-display text-2xl font-bold">Sources ({sources.length})</h1>
        <p className="mt-2 max-w-3xl text-sm text-ink-muted">
          The sites the old crawler collected fact-checks from, with how much of the dataset and the archive came from each.
          {active} of {sources.length} are active. Legacy rows can be edited and set inactive but not deleted; sites added here can be
          removed. Click a site to see the listing pages the old crawler walked.
        </p>
      </div>
      <SourcesTable sources={sources} crawlQueue={crawlQueue} />
    </div>
  );
}
