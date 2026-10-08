import { getCrawlQueue, listSourcesAdmin, sourceFilterFrom } from "@/lib/sources-admin";
import { SourcesTable } from "@/components/admin/SourcesTable";
import { AdminPageHeader } from "@/components/admin/AdminPage";
import { requireAdmin } from "@/lib/require-admin";
import { getAdminT } from "@/lib/admin-lang-server";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAdminT();
  return { title: t("Sources") };
}

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function SourcesPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireAdmin();
  const { t } = await getAdminT();
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
        title={t("Sources")}
        count={all.length}
        description={t(
          "The fact-check websites the old crawler (the automatic page collector) read from, and how many dataset rows and archive entries came from each. {active} of {total} are active. Old sites can be edited or turned off; sites added here can also be deleted.",
          { active, total: all.length },
        )}
      />
      <SourcesTable sources={sources} crawlQueue={crawlQueue} sort={f.sort ? { key: f.sort, order: f.order ?? defaultOrder } : undefined} />
    </div>
  );
}
