"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { DatasetItem } from "@/lib/dataset-admin";
import { formatDate, outboundLink } from "@/lib/sources";
import { clsx } from "@/lib/clsx";

const RESET = "__imported";

/** Rows of the legacy dataset with an inline label editor and an "Add to archive" action. */
export function DatasetTable({ items: initial, labels }: { items: DatasetItem[]; labels: string[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [busy, setBusy] = useState<number | null>(null);

  const update = (id: number, patch: Partial<DatasetItem>) => setItems((list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  async function relabel(row: DatasetItem, value: string) {
    const label = value === RESET ? null : value;
    const before = { adminLabel: row.adminLabel, effectiveLabel: row.effectiveLabel };
    update(row.id, { adminLabel: label, effectiveLabel: label ?? row.label });
    setBusy(row.id);
    try {
      const res = await fetch(`/api/admin/dataset/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      });
      if (!res.ok) throw new Error();
      const { item } = (await res.json()) as { item: DatasetItem };
      update(row.id, item);
      router.refresh();
    } catch {
      update(row.id, before);
      alert("Failed to save the label.");
    } finally {
      setBusy(null);
    }
  }

  async function addToArchive(row: DatasetItem) {
    setBusy(row.id);
    try {
      const res = await fetch(`/api/admin/dataset/${row.id}/archive`, { method: "POST" });
      const data = (await res.json()) as { slug?: string | null; published?: boolean; withText?: boolean; error?: string };
      if (!res.ok) {
        if (data.slug) update(row.id, { archiveSlug: data.slug });
        alert(data.error ?? "Failed to add.");
        return;
      }
      update(row.id, { archiveSlug: data.slug ?? null, archivePublished: !!data.published });
      router.refresh();
    } catch {
      alert("Failed to add.");
    } finally {
      setBusy(null);
    }
  }

  if (items.length === 0) {
    return <div className="neu p-10 text-center text-sm text-ink-muted">No dataset rows match.</div>;
  }

  const grid = "md:grid-cols-[60px_150px_1fr_90px_130px_150px]";
  return (
    <div className="neu overflow-hidden p-0">
      <div className={clsx("hidden gap-3 border-b border-hairline px-5 py-3 text-xs font-semibold uppercase tracking-wider text-ink-faint md:grid", grid)}>
        <span>#</span>
        <span>Label</span>
        <span>Title</span>
        <span>Date</span>
        <span>Source</span>
        <span className="text-right">Archive</span>
      </div>
      <ul className="divide-y divide-hairline">
        {items.map((r) => {
          const link = r.url ? outboundLink(r.url, r.publishedOn ?? undefined) : null;
          const edited = r.adminLabel !== null && r.adminLabel !== r.label;
          return (
            <li key={r.id} className={clsx("grid grid-cols-1 gap-2 px-5 py-3 md:items-center md:gap-3", grid)}>
              <span className="font-mono text-xs text-ink-faint">{r.id}</span>
              <div className="flex items-center gap-1.5">
                <select
                  value={r.adminLabel ?? RESET}
                  disabled={busy === r.id}
                  onChange={(e) => relabel(r, e.target.value)}
                  aria-label={`Label of row ${r.id}`}
                  className="w-full rounded-lg border border-hairline bg-surface-sunken px-2 py-1.5 text-xs text-ink outline-none focus:ring-2 focus:ring-brand/30 disabled:opacity-50"
                >
                  <option value={RESET}>{r.label ? `Imported: ${r.label}` : "No label"}</option>
                  {labels.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
                {edited && (
                  <span title={`Imported label: ${r.label ?? "none"}`} className="shrink-0 rounded-full bg-verdict-warn/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-verdict-warn">
                    edited
                  </span>
                )}
              </div>
              <div className="min-w-0">
                {link ? (
                  <a href={link.href} target="_blank" rel="noopener noreferrer" className="line-clamp-2 text-sm font-medium hover:text-brand" title={r.url}>
                    {r.title || "(no title)"}
                  </a>
                ) : (
                  <span className="line-clamp-2 text-sm font-medium">{r.title || "(no title)"}</span>
                )}
                {link?.archived && <span className="text-[10px] uppercase tracking-wider text-ink-faint">archived copy</span>}
              </div>
              <span className="text-xs text-ink-muted">{r.publishedOn ? formatDate(r.publishedOn) || r.publishedOn : "—"}</span>
              <span className="truncate text-xs text-ink-muted" title={r.site}>{r.site || "—"}</span>
              <div className="flex items-center gap-2 md:justify-end">
                {r.archiveSlug ? (
                  <>
                    {!r.archivePublished && (
                      <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-faint">hidden</span>
                    )}
                    <Link href={`/admin/articles/${r.archiveSlug}/edit`} className="rounded-full border border-hairline px-3 py-1.5 text-xs font-medium hover:border-ink">
                      In archive →
                    </Link>
                  </>
                ) : (
                  <button
                    onClick={() => addToArchive(r)}
                    disabled={busy === r.id}
                    className="rounded-full border border-hairline px-3 py-1.5 text-xs font-medium hover:border-ink disabled:opacity-50"
                  >
                    {busy === r.id ? "…" : "Add to archive"}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
