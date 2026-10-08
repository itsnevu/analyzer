"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import type { SearchRow } from "@/lib/searches";
import { VERDICT_META } from "@/lib/verdict";
import { clsx } from "@/lib/clsx";
import { DataGrid, type GridColumn, type GridPaging } from "@/components/admin/DataGrid";
import { useAdminT } from "@/components/admin/AdminLang";

type Item = SearchRow & { when: string };

const pill = "whitespace-nowrap rounded-full border border-hairline px-3 py-1 text-xs font-medium hover:border-ink disabled:opacity-50";
const dateField = "h-8 rounded-md border border-hairline bg-surface-raised px-1.5 text-sm text-ink outline-none focus:ring-2 focus:ring-brand/30";
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
  const { t } = useAdminT();
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
    if (!confirm(t("Delete this search from the log?"))) return;
    setBusy(r.id);
    try {
      const res = await fetch(`/api/admin/searches/${r.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setRemoved((s) => new Set(s).add(r.id));
      router.refresh();
    } catch {
      alert(t("Could not delete it. Please try again."));
    } finally {
      setBusy(null);
    }
  }

  const columns: GridColumn<Item>[] = [
    {
      key: "query",
      header: t("Text checked"),
      sortable: true,
      param: "q",
      filter: { type: "text", placeholder: t("Search the texts…") },
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
      header: t("Verdict"),
      width: "130px",
      sortable: true,
      filter: {
        type: "select",
        options: [
          { value: "hoax", label: t("Hoax") },
          { value: "misleading", label: t("Misleading") },
          { value: "valid", label: t("Credible") },
          { value: "none", label: t("No verdict (old log)") },
        ],
        placeholder: t("Any verdict"),
      },
      render: (r) => {
        const m = r.verdict && r.verdict in VERDICT_META ? VERDICT_META[r.verdict as keyof typeof VERDICT_META] : null;
        return m ? (
          <span className="text-sm font-semibold" style={{ color: m.color }}>
            {t(m.label)}
          </span>
        ) : (
          <span className="text-sm text-ink-faint">—</span>
        );
      },
    },
    {
      key: "origin",
      header: t("Where from"),
      width: "120px",
      sortable: true,
      filter: {
        type: "select",
        options: [
          { value: "site", label: t("This site") },
          { value: "legacy", label: t("Old panel log") },
        ],
        placeholder: t("Both"),
      },
      render: (r) => <span className="text-sm text-ink-muted">{r.origin === "legacy" ? t("Old panel") : t("This site")}</span>,
    },
    {
      key: "date",
      header: t("Time (WIB)"),
      width: "170px",
      sortable: true,
      render: (r) => <span className="whitespace-nowrap text-sm text-ink-muted">{r.when}</span>,
    },
    {
      key: "actions",
      header: <span className="sr-only">{t("Actions")}</span>,
      width: "180px",
      align: "right",
      render: (r) => (
        <div className="flex justify-end gap-1.5">
          <Link href={`/admin/detect?text=${encodeURIComponent(r.query)}`} className={pill} title={t("Load this text in the detection lab")}>
            {t("Test in lab")}
          </Link>
          <button type="button" onClick={() => remove(r)} disabled={busy === r.id} className={clsx(pill, "text-verdict-hoax hover:bg-verdict-hoax/10")}>
            {busy === r.id ? "…" : t("Delete")}
          </button>
        </div>
      ),
    },
  ];

  return (
    <DataGrid
      caption={t("Search log")}
      columns={columns}
      rows={items.filter((r) => !removed.has(r.id))}
      rowKey={(r) => String(r.id)}
      paging={paging}
      pageSizes={[25, 50, 100]}
      sort={sort}
      toolbar={
        <div className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
          <label className="flex items-center gap-1">
            {t("From")}
            <input type="date" value={range.from} max={range.to || undefined} onChange={(e) => applyRange({ from: e.target.value })} className={dateField} />
          </label>
          <label className="flex items-center gap-1">
            {t("To")}
            <input type="date" value={range.to} min={range.from || undefined} onChange={(e) => applyRange({ to: e.target.value })} className={dateField} />
          </label>
          {(range.from || range.to) && (
            <button
              type="button"
              onClick={() => applyRange({ from: "", to: "" }, 0)}
              className="px-1 text-ink-muted hover:text-ink"
              aria-label={t("Clear the date range")}
            >
              ×
            </button>
          )}
        </div>
      }
      toolbarRight={
        <a href={exportHref} className="btn-primary px-3 py-1.5 text-xs">
          {t("Export CSV")}
        </a>
      }
      emptyMessage={t("No searches match these filters.")}
      dense
    />
  );
}
