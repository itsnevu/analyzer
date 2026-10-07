"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AdminLogEntry } from "@/lib/admin-log";
import { clsx } from "@/lib/clsx";

export type ActivityItem = AdminLogEntry & { label: string; when: string };

/** Actions whose target is an article slug that still exists (so the row can link to the editor). */
const SLUG_ACTIONS = new Set(["article.create", "article.update", "review"]);

/** Rows of the activity log; `when` is the time already formatted in WIB, `label` the readable action. */
export function ActivityTable({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return <div className="neu p-10 text-center text-sm text-ink-muted">No activity matches.</div>;
  }
  const grid = "md:grid-cols-[150px_190px_200px_1fr_120px]";
  return (
    <div className="neu overflow-hidden p-0">
      <div className={clsx("hidden gap-3 border-b border-hairline px-5 py-3 text-xs font-semibold uppercase tracking-wider text-ink-faint md:grid", grid)}>
        <span>Time (WIB)</span>
        <span>Action</span>
        <span>Target</span>
        <span>Detail</span>
        <span>Address</span>
      </div>
      <ul className="divide-y divide-hairline">
        {items.map((r) => {
          const link = SLUG_ACTIONS.has(r.action) && r.target && !r.detail.startsWith("delete") ? `/admin/articles/${r.target}/edit` : null;
          return (
            <li key={r.id} className={clsx("grid grid-cols-1 gap-1 px-5 py-3 text-sm md:items-center md:gap-3", grid)}>
              <span className="text-xs text-ink-muted" title={r.at}>{r.when}</span>
              <div className="min-w-0">
                <div className="truncate font-medium">{r.label}</div>
                <div className="truncate font-mono text-[10px] text-ink-faint">{r.action}</div>
              </div>
              <div className="min-w-0 truncate text-xs" title={r.target}>
                {link ? (
                  <Link href={link} className="text-brand hover:underline">{r.target}</Link>
                ) : (
                  <span className={r.target ? "" : "text-ink-faint"}>{r.target || "—"}</span>
                )}
              </div>
              <span className="min-w-0 truncate text-xs text-ink-muted" title={r.detail}>{r.detail || "—"}</span>
              <span className="font-mono text-xs text-ink-faint">{r.ip || "—"}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Deletes entries older than `days` after a confirmation, then refreshes the list. */
export function ClearActivityButton({ days = 90 }: { days?: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function clear() {
    if (!confirm(`Delete every activity entry older than ${days} days? This cannot be undone.`)) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/activity/clear", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ days }) });
      const data = (await res.json().catch(() => ({}))) as { deleted?: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setMessage(`Deleted ${(data.deleted ?? 0).toLocaleString("en-US")} entries.`);
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to clear.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={clear}
        disabled={busy}
        className="rounded-full border border-hairline px-3.5 py-2 text-sm font-medium text-verdict-hoax transition-colors hover:bg-verdict-hoax/10 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
      >
        {busy ? "Clearing…" : `Clear entries older than ${days} days`}
      </button>
      {message && <span role="status" className="text-xs text-ink-muted">{message}</span>}
    </span>
  );
}
