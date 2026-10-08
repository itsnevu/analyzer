"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { DatasetItem } from "@/lib/dataset-admin";
import { outboundLink } from "@/lib/sources";
import { DataGrid, type GridColumn, type GridPaging } from "@/components/admin/DataGrid";
import { useAdminT } from "@/components/admin/AdminLang";
import { adminLocale, formatAdminNumber, tk, type AdminLang } from "@/lib/admin-lang";

const RESET = "__imported";

const LABEL_NAME: Record<string, string> = {
  HOAX: tk("Hoax"), DISINFORMATION: tk("Disinformation"), INFORMATION: tk("Information"), FACT: tk("Fact"),
  EDUKASI: tk("Education"), KLARIFIKASI: tk("Clarification"), UNKNOWN: tk("Unknown"),
};

/** "9 Oct 2026" / "9 Okt 2026" for a "YYYY-MM-DD" date; "" when it is not one. */
const day = (date: string, lang: AdminLang) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "";
  const d = new Date(`${date}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(adminLocale(lang), { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
};

const pill = "inline-block whitespace-nowrap rounded-full border border-hairline px-3 py-1 text-sm font-medium hover:border-ink disabled:opacity-50";

/**
 * Rows of the legacy dataset on the panel grid, with an inline label editor
 * and an "Add to archive" action. Edits are kept as patches over the server's
 * rows, so they survive the refresh that follows without remounting the grid.
 */
export function DatasetTable({
  items,
  labels,
  tab,
  sources,
  years,
  paging,
  sort,
  exportHref,
}: {
  items: DatasetItem[];
  labels: string[];
  tab: "categorized" | "uncategorized";
  sources: { id: number; site: string; count: number }[];
  years: string[];
  paging: GridPaging;
  sort: { key: string; order: "asc" | "desc" };
  exportHref: string;
}) {
  const router = useRouter();
  const { t, lang } = useAdminT();
  const [patches, setPatches] = useState<Record<number, Partial<DatasetItem>>>({});
  const [busy, setBusy] = useState<number | null>(null);

  const update = (id: number, patch: Partial<DatasetItem>) => setPatches((p) => ({ ...p, [id]: { ...p[id], ...patch } }));
  const rows = items.map((r) => (patches[r.id] ? { ...r, ...patches[r.id] } : r));

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
      alert(t("Could not save the label. Please try again."));
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
        alert(data.error ?? t("Could not add it to the archive."));
        return;
      }
      update(row.id, { archiveSlug: data.slug ?? null, archivePublished: !!data.published });
      router.refresh();
    } catch {
      alert(t("Could not add it to the archive."));
    } finally {
      setBusy(null);
    }
  }

  const columns: GridColumn<DatasetItem>[] = [
    {
      key: "id",
      header: "#",
      width: "72px",
      sortable: true,
      render: (r) => <span className="font-mono text-sm text-ink-faint">{r.id}</span>,
    },
    {
      key: "label",
      header: t("Label"),
      width: "200px",
      // Uncategorized rows have no effective label to filter by.
      filter:
        tab === "categorized"
          ? { type: "select", options: labels.map((l) => ({ value: l, label: `${LABEL_NAME[l] ? t(LABEL_NAME[l]) : l} (${l})` })), placeholder: t("All labels") }
          : undefined,
      render: (r) => {
        const edited = r.adminLabel !== null && r.adminLabel !== r.label;
        return (
          <div className="flex items-center gap-1.5">
            <select
              value={r.adminLabel ?? RESET}
              disabled={busy === r.id}
              onChange={(e) => relabel(r, e.target.value)}
              aria-label={t("Label of row {id}", { id: String(r.id) })}
              className="w-full rounded-md border border-hairline bg-surface-sunken px-2 py-1 text-sm text-ink outline-none focus:ring-2 focus:ring-brand/30 disabled:opacity-50"
            >
              <option value={RESET}>{r.label ? t("Imported: {label}", { label: r.label }) : t("No label")}</option>
              {labels.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
            {edited && (
              <span
                title={t("Imported label: {label}", { label: r.label ?? t("None") })}
                className="shrink-0 rounded-full bg-verdict-warn/15 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-verdict-warn"
              >
                {t("Edited")}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "title",
      header: t("Title"),
      sortable: true,
      param: "q",
      filter: { type: "text", placeholder: t("Search the titles…") },
      className: "min-w-[260px]",
      render: (r) => {
        const link = r.url ? outboundLink(r.url, r.publishedOn ?? undefined) : null;
        return (
          <div className="min-w-0">
            {link ? (
              <a href={link.href} target="_blank" rel="noopener noreferrer" className="line-clamp-2 font-medium hover:text-brand" title={r.url}>
                {r.title || t("(no title)")}
              </a>
            ) : (
              <span className="line-clamp-2 font-medium">{r.title || t("(no title)")}</span>
            )}
            {link?.archived && <span className="text-[11px] uppercase tracking-wider text-ink-faint">{t("Archived copy")}</span>}
          </div>
        );
      },
    },
    {
      key: "date",
      header: t("Date"),
      width: "120px",
      sortable: true,
      param: "year",
      filter: { type: "select", options: years.map((y) => ({ value: y, label: y })), placeholder: t("Any year") },
      render: (r) => <span className="whitespace-nowrap text-sm text-ink-muted">{r.publishedOn ? day(r.publishedOn, lang) || r.publishedOn : "—"}</span>,
    },
    {
      key: "source",
      header: t("Source"),
      width: "170px",
      filter: {
        type: "select",
        options: sources.map((s) => ({ value: String(s.id), label: `${s.site} (${formatAdminNumber(s.count, lang)})` })),
        placeholder: t("All sites"),
      },
      render: (r) => (
        <span className="block max-w-[170px] truncate text-sm text-ink-muted" title={r.site}>
          {r.site || "—"}
        </span>
      ),
    },
    {
      key: "archived",
      header: t("Archive"),
      width: "170px",
      align: "right",
      filter: {
        type: "select",
        options: [
          { value: "yes", label: t("In the archive") },
          { value: "no", label: t("Not in the archive") },
        ],
        placeholder: t("Either"),
      },
      render: (r) =>
        r.archiveSlug ? (
          <div className="flex items-center justify-end gap-2">
            {!r.archivePublished && (
              <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">{t("Hidden")}</span>
            )}
            <Link href={`/admin/articles/${r.archiveSlug}/edit`} className={pill}>
              {t("In the archive")} →
            </Link>
          </div>
        ) : (
          <button type="button" onClick={() => addToArchive(r)} disabled={busy === r.id} className={pill}>
            {busy === r.id ? "…" : t("Add to archive")}
          </button>
        ),
    },
  ];

  return (
    <DataGrid
      caption={tab === "categorized" ? t("Rows with a label") : t("Rows without a label")}
      columns={columns}
      rows={rows}
      rowKey={(r) => String(r.id)}
      paging={paging}
      pageSizes={[25, 50, 100]}
      sort={sort}
      toolbarRight={
        <a href={exportHref} className="btn-primary px-3 py-1.5 text-xs">
          {t("Export CSV")}
        </a>
      }
      emptyMessage={t("No rows match these filters.")}
      dense
    />
  );
}
