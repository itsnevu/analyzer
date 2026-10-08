import type { Metadata } from "next";
import Link from "next/link";
import { actionLabel, adminLogActions, adminLogFilterFrom, listAdminLog } from "@/lib/admin-log";
import { ActivityTable, ClearActivityButton } from "@/components/admin/ActivityTable";
import { Pagination } from "@/components/ui/Pagination";
import { formatAdminDateTime, formatAdminNumber } from "@/lib/admin-lang";
import { getAdminT } from "@/lib/admin-lang-server";
import { requireAdmin } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAdminT();
  return { title: t("Activity log") };
}

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const field = "rounded-lg border border-hairline bg-surface-sunken px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-brand/30";

/** Puts elements where a translated sentence has {name} placeholders, so the sentence stays one dictionary entry. */
function withLinks(text: string, parts: Record<string, React.ReactNode>): React.ReactNode[] {
  return text.split(/(\{\w+\})/).map((piece, i) => {
    const m = piece.match(/^\{(\w+)\}$/);
    return m && m[1] in parts ? <span key={i}>{parts[m[1]]}</span> : piece;
  });
}

export default async function ActivityPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireAdmin();
  const { t, lang } = await getAdminT();
  const n = (v: number) => formatAdminNumber(v, lang);
  const sp = await searchParams;
  const f = adminLogFilterFrom((k) => one(sp[k]) || undefined);
  const result = listAdminLog({ ...f, pageSize: 100 });
  const actions = adminLogActions();

  const query = (changes: { page?: number } = {}) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ action: f.action, from: f.from, to: f.to })) if (v) p.set(k, v);
    if (changes.page && changes.page > 1) p.set("page", String(changes.page));
    return p.toString();
  };
  const href = (changes: { page?: number } = {}) => {
    const s = query(changes);
    return s ? `/admin/activity?${s}` : "/admin/activity";
  };
  const first = result.total ? (result.page - 1) * result.pageSize + 1 : 0;
  const last = Math.min(result.page * result.pageSize, result.total);
  const items = result.items.map((r) => ({ ...r, label: t(actionLabel(r.action)), when: formatAdminDateTime(r.at, lang) }));

  return (
    <div className="space-y-4">
      <div className="neu p-6">
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-[1.75rem]">
          {t("Activity log")} <span className="align-middle font-mono text-sm font-medium text-ink-faint">{n(result.total)}</span>
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-ink-muted">
          {withLinks(
            t(
              "Everything done in this admin panel, and from which internet address: logins, article changes, review decisions, dataset and settings changes, model training, report updates and the maintenance buttons on the {system} page. What visitors do on the site is in the {research}, not here.",
            ),
            {
              system: (
                <Link href="/admin/system" className="text-brand hover:underline">
                  {t("System")}
                </Link>
              ),
              research: (
                <Link href="/admin/research" className="text-brand hover:underline">
                  {t("research log")}
                </Link>
              ),
            },
          )}
        </p>
      </div>

      <form action="/admin/activity" method="get" className="neu flex flex-wrap items-center gap-2 p-3 text-sm">
        <select name="action" defaultValue={f.action ?? ""} className={field} aria-label={t("Action")}>
          <option value="">{t("All actions")}</option>
          {actions.map((a) => (
            <option key={a.action} value={a.action}>
              {t(actionLabel(a.action))} ({n(a.count)})
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-ink-muted">
          {t("From")} <input type="date" name="from" defaultValue={f.from} className={field} />
        </label>
        <label className="flex items-center gap-1.5 text-sm text-ink-muted">
          {t("To")} <input type="date" name="to" defaultValue={f.to} className={field} />
        </label>
        <button type="submit" className="neu-btn px-4 py-2">
          {t("Apply")}
        </button>
        {(f.action || f.from || f.to) && (
          <Link href="/admin/activity" className="px-2 text-sm text-ink-muted hover:text-ink">
            {t("Reset")}
          </Link>
        )}
        <span className="flex-1" />
        <a href={`/api/admin/activity/export?${query()}`} className="btn-primary px-4 py-2 text-sm">
          {t("Export CSV")}
        </a>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-muted">{t("Showing {first}–{last} of {total}", { first, last, total: result.total })}</p>
        <ClearActivityButton days={90} />
      </div>

      <ActivityTable items={items} />
      <Pagination
        page={result.page}
        pages={result.pages}
        hrefFor={(p) => href({ page: p })}
        labels={{ nav: t("Pages"), prev: t("← Previous"), next: t("Next →") }}
      />
    </div>
  );
}
