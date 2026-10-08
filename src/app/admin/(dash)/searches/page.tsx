import type { Metadata } from "next";
import Link from "next/link";
import { getSearchOverview, listSearches, searchFilterFrom } from "@/lib/searches";
import { SearchesTable } from "@/components/admin/SearchesTable";
import { AdminPageHeader, StatTile } from "@/components/admin/AdminPage";
import { adminLocale, formatAdminDateTime, formatAdminNumber, type AdminLang } from "@/lib/admin-lang";
import { getAdminT } from "@/lib/admin-lang-server";
import { requireAdmin } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAdminT();
  return { title: t("Searches") };
}

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Site rows are stored in UTC; legacy rows already carry the old server's WIB time. */
function wib(createdAt: string, origin: string, lang: AdminLang): string {
  const d = origin === "legacy" ? new Date(`${createdAt.replace(" ", "T")}+07:00`) : new Date(`${createdAt.replace(" ", "T")}Z`);
  if (Number.isNaN(d.getTime())) return createdAt;
  return formatAdminDateTime(d.toISOString(), lang);
}

/** "9 Oct 2026" / "9 Okt 2026" from the date part of a timestamp. */
function day(iso: string | null, lang: AdminLang): string {
  if (!iso) return "—";
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso.slice(0, 10) : d.toLocaleDateString(adminLocale(lang), { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export default async function SearchesPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireAdmin();
  const { t, lang } = await getAdminT();
  const sp = await searchParams;
  const f = searchFilterFrom((k) => one(sp[k]) || undefined);
  const result = listSearches(f);
  const overview = getSearchOverview();
  const n = (v: number) => formatAdminNumber(v, lang);

  const exportQuery = new URLSearchParams();
  for (const [k, v] of Object.entries({ q: f.q, from: f.from, to: f.to, origin: f.origin, verdict: f.verdict })) if (v) exportQuery.set(k, v);
  const items = result.items.map((r) => ({ ...r, when: wib(r.createdAt, r.origin, lang) }));
  const [before, after = ""] = t(
    "Every text people checked with the detector, from the old panel's log (April 2019 – February 2024) and from this site, with the verdict given. No IP addresses are kept here; network, device and role data are in the {link}.",
  ).split("{link}");

  return (
    <div>
      <AdminPageHeader
        title={t("Searches")}
        count={overview.total}
        description={
          <>
            {before}
            <Link href="/admin/research" className="text-brand hover:underline">
              {t("research log")}
            </Link>
            {after}
          </>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label={t("Searches")} value={n(overview.total)} tone="brand" />
        <StatTile label={t("Different texts")} value={n(overview.distinct)} />
        <StatTile label={t("Links pasted")} value={n(overview.links)} />
        <StatTile label={t("From this site")} value={n(overview.fromSite)} tone="valid" />
        <StatTile label={t("First search")} value={day(overview.first, lang)} />
        <StatTile label={t("Latest search")} value={day(overview.last, lang)} />
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
