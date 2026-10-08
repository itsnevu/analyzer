import Link from "next/link";
import { getSearchOverview, listSearches, searchFilterFrom } from "@/lib/searches";
import { SearchesTable } from "@/components/admin/SearchesTable";
import { AdminPageHeader, StatTile } from "@/components/admin/AdminPage";
import { formatCount } from "@/lib/sources";
import { requireAdmin } from "@/lib/require-admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Searches" };

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Site rows are stored in UTC; legacy rows already carry the old server's WIB time. */
function wib(createdAt: string, origin: string): string {
  const d = origin === "legacy" ? new Date(`${createdAt.replace(" ", "T")}+07:00`) : new Date(`${createdAt.replace(" ", "T")}Z`);
  if (Number.isNaN(d.getTime())) return createdAt;
  return d.toLocaleString("en-GB", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" });
}

export default async function SearchesPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireAdmin();
  const sp = await searchParams;
  const f = searchFilterFrom((k) => one(sp[k]) || undefined);
  const result = listSearches(f);
  const overview = getSearchOverview();

  const exportQuery = new URLSearchParams();
  for (const [k, v] of Object.entries({ q: f.q, from: f.from, to: f.to, origin: f.origin, verdict: f.verdict })) if (v) exportQuery.set(k, v);
  const items = result.items.map((r) => ({ ...r, when: wib(r.createdAt, r.origin) }));
  const day = (iso: string | null) => (iso ? iso.slice(0, 10) : "—");

  return (
    <div>
      <AdminPageHeader
        title="Searches"
        count={overview.total}
        description={
          <>
            Everything submitted to the detector, from the old panel&apos;s log (April 2019 – February 2024) and from this site, with the verdict
            given. No IP addresses are kept here; see the{" "}
            <Link href="/admin/research" className="text-brand hover:underline">
              research log
            </Link>{" "}
            for network, device and role data.
          </>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Searches" value={formatCount(overview.total)} tone="brand" />
        <StatTile label="Distinct texts" value={formatCount(overview.distinct)} />
        <StatTile label="Pasted links" value={formatCount(overview.links)} />
        <StatTile label="From this site" value={formatCount(overview.fromSite)} tone="valid" />
        <StatTile label="First" value={day(overview.first)} />
        <StatTile label="Latest" value={day(overview.last)} />
      </div>

      <SearchesTable
        items={items}
        paging={{ page: result.page, pages: result.pages, total: result.total, pageSize: result.pageSize }}
        sort={{ key: f.sort ?? "date", order: f.order ?? "desc" }}
        exportHref={`/api/admin/searches/export?${exportQuery.toString()}`}
      />
    </div>
  );
}
