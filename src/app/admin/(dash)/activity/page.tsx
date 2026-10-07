import Link from "next/link";
import { actionLabel, adminLogActions, adminLogFilterFrom, listAdminLog } from "@/lib/admin-log";
import { ActivityTable, ClearActivityButton } from "@/components/admin/ActivityTable";
import { Pagination } from "@/components/ui/Pagination";
import { formatCount } from "@/lib/sources";

export const dynamic = "force-dynamic";
export const metadata = { title: "Activity log" };

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const field = "rounded-lg border border-hairline bg-surface-sunken px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-brand/30";
const wib = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("en-GB", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" });
};

export default async function ActivityPage({ searchParams }: { searchParams: Promise<Params> }) {
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
  const items = result.items.map((r) => ({ ...r, label: actionLabel(r.action), when: wib(r.at) }));

  return (
    <div className="space-y-4">
      <div className="neu p-6">
        <span className="eyebrow">Settings</span>
        <h1 className="mt-2 font-display text-2xl font-bold">Activity log ({formatCount(result.total)})</h1>
        <p className="mt-2 max-w-3xl text-sm text-ink-muted">
          What was done in this panel and from which address: logins, article edits and bulk actions, review decisions, dataset and settings
          changes, model training, report status changes and the maintenance actions on the{" "}
          <Link href="/admin/system" className="text-brand hover:underline">System</Link> page. Visitors&apos; own use of the site is in the{" "}
          <Link href="/admin/research" className="text-brand hover:underline">research log</Link>, not here.
        </p>
      </div>

      <form action="/admin/activity" method="get" className="neu flex flex-wrap items-center gap-2 p-3 text-sm">
        <select name="action" defaultValue={f.action ?? ""} className={field} aria-label="Action">
          <option value="">All actions</option>
          {actions.map((a) => (
            <option key={a.action} value={a.action}>
              {actionLabel(a.action)} ({formatCount(a.count)})
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-ink-muted">
          From <input type="date" name="from" defaultValue={f.from} className={field} />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-ink-muted">
          To <input type="date" name="to" defaultValue={f.to} className={field} />
        </label>
        <button type="submit" className="neu-btn px-4 py-2">Apply</button>
        {(f.action || f.from || f.to) && (
          <Link href="/admin/activity" className="px-2 text-xs text-ink-muted hover:text-ink">Reset</Link>
        )}
        <span className="flex-1" />
        <a href={`/api/admin/activity/export?${query()}`} className="btn-primary px-4 py-2 text-sm">Export CSV</a>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-ink-muted">
          View {formatCount(first)}–{formatCount(last)} of {formatCount(result.total)}
        </p>
        <ClearActivityButton days={90} />
      </div>

      <ActivityTable items={items} />
      <Pagination page={result.page} pages={result.pages} hrefFor={(p) => href({ page: p })} />
    </div>
  );
}
