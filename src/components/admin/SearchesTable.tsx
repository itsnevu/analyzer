"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import type { SearchRow } from "@/lib/searches";
import { VERDICT_META } from "@/lib/verdict";
import { clsx } from "@/lib/clsx";
import { DataGrid, type GridColumn, type GridPaging } from "@/components/admin/DataGrid";

type Item = SearchRow & { when: string };

const pill = "whitespace-nowrap rounded-full border border-hairline px-3 py-1 text-xs font-medium hover:border-ink disabled:opacity-50";
const dateField = "h-7 rounded-md border border-hairline bg-surface-raised px-1.5 text-xs text-ink outline-none focus:ring-2 focus:ring-brand/30";
const DEBOUNCE_MS = 500;

/** The search log on the panel grid; `when` is the time already formatted in WIB. */
export function SearchesTable({
  items,
  paging,
  sort,
  exportHref,
}: {
  items: Item[];
  paging: GridPaging;
  sort: { key: string; order: "asc" | "desc" };
  exportHref: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [removed, setRemoved] = useState<ReadonlySet<number>>(new Set());
  const [busy, setBusy] = useState<number | null>(null);
  const timer = useRef<number | null>(null);

  // The from/to inputs follow the URL, like the grid's own filters; typing a date applies after a short pause.
  const fromUrl = { from: search.get("from") ?? "", to: search.get("to") ?? "" };
  const urlKey = `${fromUrl.from}|${fromUrl.to}`;
  const [seenKey, setSeenKey] = useState(urlKey);
  const [range, setRange] = useState(fromUrl);
  if (seenKey !== urlKey) {
    setSeenKey(urlKey);
    setRange(fromUrl);
  }

  function applyRange(changes: Partial<Record<"from" | "to", string>>, delay = DEBOUNCE_MS) {
    // Both ends go to the URL together, so a quick second edit does not drop the first.
    const next = { ...range, ...changes };
    setRange(next);
    if (timer.current) window.clearTimeout(timer.current);
    if (Object.values(next).some((v) => v && !/^\d{4}-\d{2}-\d{2}$/.test(v))) return;
    timer.current = window.setTimeout(() => {
      const p = new URLSearchParams(search.toString());
      for (const [k, v] of Object.entries(next)) {
        if (v) p.set(k, v);
        else p.delete(k);
      }
      p.delete("page");
      const s = p.toString();
      router.replace(s ? `${pathname}?${s}` : pathname);
    }, delay);
  }

  async function remove(r: Item) {
    if (!confirm("Delete this search from the log?")) return;
    setBusy(r.id);
    try {
      const res = await fetch(`/api/admin/searches/${r.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setRemoved((s) => new Set(s).add(r.id));
      router.refresh();
    } catch {
      alert("Failed to delete.");
    } finally {
      setBusy(null);
    }
  }

  const columns: GridColumn<Item>[] = [
    {
      key: "query",
      header: "Query",
      sortable: true,
      param: "q",
      filter: { type: "text", placeholder: "Keyword…" },
      className: "min-w-[280px]",
      render: (r) => (
        <div className="min-w-0" title={r.query}>
          {/^https?:\/\//i.test(r.query) ? (
            <a href={r.query} target="_blank" rel="noopener noreferrer" className="line-clamp-2 break-all text-brand hover:underline">
              {r.query}
            </a>
          ) : (
            <span className="line-clamp-2 break-words">{r.query}</span>
          )}
        </div>
      ),
    },
    {
      key: "verdict",
      header: "Verdict",
      width: "130px",
      sortable: true,
      filter: {
        type: "select",
        options: [
          { value: "hoax", label: "Hoax" },
          { value: "misleading", label: "Misleading" },
          { value: "valid", label: "Credible" },
          { value: "none", label: "No verdict (legacy)" },
        ],
        placeholder: "Any verdict",
      },
      render: (r) => {
        const m = r.verdict && r.verdict in VERDICT_META ? VERDICT_META[r.verdict as keyof typeof VERDICT_META] : null;
        return m ? (
          <span className="text-xs font-semibold" style={{ color: m.color }}>
            {m.labelEn}
          </span>
        ) : (
          <span className="text-xs text-ink-faint">—</span>
        );
      },
    },
    {
      key: "origin",
      header: "Origin",
      width: "120px",
      sortable: true,
      filter: {
        type: "select",
        options: [
          { value: "site", label: "This site" },
          { value: "legacy", label: "Legacy log" },
        ],
        placeholder: "Both",
      },
      render: (r) => <span className="text-xs text-ink-muted">{r.origin === "legacy" ? "Legacy" : "This site"}</span>,
    },
    {
      key: "date",
      header: "Time (WIB)",
      width: "170px",
      sortable: true,
      render: (r) => <span className="whitespace-nowrap text-xs text-ink-muted">{r.when}</span>,
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      width: "180px",
      align: "right",
      render: (r) => (
        <div className="flex justify-end gap-1.5">
          <Link href={`/admin/detect?text=${encodeURIComponent(r.query)}`} className={pill} title="Load this text in the detection lab">
            Open in lab
          </Link>
          <button type="button" onClick={() => remove(r)} disabled={busy === r.id} className={clsx(pill, "text-verdict-hoax hover:bg-verdict-hoax/10")}>
            {busy === r.id ? "…" : "Delete"}
          </button>
        </div>
      ),
    },
  ];

  return (
    <DataGrid
      caption="Search log"
      columns={columns}
      rows={items.filter((r) => !removed.has(r.id))}
      rowKey={(r) => String(r.id)}
      paging={paging}
      pageSizes={[25, 50, 100]}
      sort={sort}
      toolbar={
        <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
          <label className="flex items-center gap-1">
            From
            <input type="date" value={range.from} max={range.to || undefined} onChange={(e) => applyRange({ from: e.target.value })} className={dateField} />
          </label>
          <label className="flex items-center gap-1">
            To
            <input type="date" value={range.to} min={range.from || undefined} onChange={(e) => applyRange({ to: e.target.value })} className={dateField} />
          </label>
          {(range.from || range.to) && (
            <button
              type="button"
              onClick={() => applyRange({ from: "", to: "" }, 0)}
              className="px-1 text-ink-muted hover:text-ink"
              aria-label="Clear the date range"
            >
              ×
            </button>
          )}
        </div>
      }
      toolbarRight={
        <a href={exportHref} className="btn-primary px-3 py-1.5 text-xs">
          Export CSV
        </a>
      }
      emptyMessage="No searches match."
      dense
    />
  );
}
