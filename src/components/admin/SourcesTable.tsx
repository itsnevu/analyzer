"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { CrawlQueueRow, SourceAdmin, SourceInput } from "@/lib/sources-admin";
import { formatCount, sourceName } from "@/lib/sources";
import { clsx } from "@/lib/clsx";
import { DataGrid, type GridColumn } from "@/components/admin/DataGrid";

const LANG_NAME: Record<string, string> = { en: "English", id: "Indonesian", ms: "Malay", "": "—" };
const field = "w-full rounded-lg border border-hairline bg-surface-sunken px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-brand/30";
const chip = "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider";
const pill = "whitespace-nowrap rounded-full border border-hairline px-3 py-1 text-xs font-medium hover:border-ink disabled:opacity-50";

const blank = (): SourceInput => ({ url: "", lang: "id", description: "", htmlPage: "", header: false, stemming: false, socialMedia: "", active: true });
const toInput = (s: SourceAdmin): SourceInput => ({
  url: s.url, lang: s.lang, description: s.description, htmlPage: s.htmlPage, header: s.header, stemming: s.stemming, socialMedia: s.socialMedia, active: s.active,
});

/**
 * Source sites on the panel grid. Clicking a site (or its ▸) opens the old
 * crawler's listing pages for it in a row under it; Edit opens the form there
 * too. "Add source" opens the form above the grid. Saved edits are kept as
 * patches over the server's rows until the refresh lands.
 */
export function SourcesTable({
  sources,
  crawlQueue,
  sort,
}: {
  sources: SourceAdmin[];
  crawlQueue: CrawlQueueRow[];
  sort?: { key: string; order: "asc" | "desc" };
}) {
  const router = useRouter();
  const [patches, setPatches] = useState<Record<number, SourceAdmin>>({});
  const [removed, setRemoved] = useState<ReadonlySet<number>>(new Set());
  const [open, setOpen] = useState<number | null>(null);
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [draft, setDraft] = useState<SourceInput>(blank());
  const [busy, setBusy] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const rows = sources.filter((s) => !removed.has(s.id)).map((s) => patches[s.id] ?? s);
  // The row open under the grid: its edit form, or its listing pages.
  const expanded = typeof editing === "number" ? editing : editing === "new" ? null : open;

  const reveal = () => requestAnimationFrame(() => panelRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }));

  function toggleOpen(id: number) {
    const wasOpen = expanded === id;
    setEditing(null);
    setOpen(wasOpen ? null : id);
  }

  function startEdit(s?: SourceAdmin) {
    setDraft(s ? toInput(s) : blank());
    setEditing(s ? s.id : "new");
    // Closing the form (Save or Cancel) folds the row back up.
    setOpen(null);
    if (!s) reveal();
  }

  async function put(id: number | "new", input: SourceInput): Promise<boolean> {
    setBusy(true);
    try {
      const res = await fetch(id === "new" ? "/api/admin/sources" : `/api/admin/sources/${id}`, {
        method: id === "new" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = (await res.json()) as { source?: SourceAdmin; error?: string };
      if (!res.ok || !data.source) throw new Error(data.error);
      const saved = data.source;
      if (id !== "new") setPatches((p) => ({ ...p, [saved.id]: saved }));
      router.refresh();
      return true;
    } catch (err) {
      alert(err instanceof Error && err.message ? err.message : "Failed to save.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (editing === null) return;
    if (!draft.url.trim()) return alert("A site URL is required.");
    if (await put(editing, draft)) setEditing(null);
  }

  async function toggleActive(s: SourceAdmin) {
    if (s.active && !confirm(`Set "${s.site}" inactive?`)) return;
    await put(s.id, { ...toInput(s), active: !s.active });
  }

  async function remove(s: SourceAdmin) {
    if (!confirm(`Delete source "${s.site}"?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/sources/${s.id}`, { method: "DELETE" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error);
      setRemoved((r) => new Set(r).add(s.id));
      if (open === s.id) setOpen(null);
      if (editing === s.id) setEditing(null);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error && err.message ? err.message : "Failed to delete.");
    } finally {
      setBusy(false);
    }
  }

  const form = (
    <div className="grid gap-3 md:grid-cols-2">
      <label className="text-xs text-ink-muted md:col-span-2">
        Site URL
        <input value={draft.url} onChange={(e) => setDraft({ ...draft, url: e.target.value })} placeholder="https://example.com/" className={clsx(field, "mt-1")} />
      </label>
      <label className="text-xs text-ink-muted">
        Language
        <select value={draft.lang} onChange={(e) => setDraft({ ...draft, lang: e.target.value })} className={clsx(field, "mt-1")}>
          <option value="en">English</option>
          <option value="id">Indonesian</option>
          <option value="ms">Malay</option>
          <option value="">Unknown</option>
        </select>
      </label>
      <label className="text-xs text-ink-muted">
        HTML page (path of the listing page)
        <input value={draft.htmlPage} onChange={(e) => setDraft({ ...draft, htmlPage: e.target.value })} className={clsx(field, "mt-1")} />
      </label>
      <label className="text-xs text-ink-muted md:col-span-2">
        Description
        <textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} rows={2} className={clsx(field, "mt-1")} />
      </label>
      <label className="text-xs text-ink-muted">
        Social media
        <input value={draft.socialMedia} onChange={(e) => setDraft({ ...draft, socialMedia: e.target.value })} placeholder="yes / no / handle" className={clsx(field, "mt-1")} />
      </label>
      <div className="flex flex-wrap items-end gap-4 text-sm">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={draft.header} onChange={(e) => setDraft({ ...draft, header: e.target.checked })} className="accent-brand" /> Keep page header
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={draft.stemming} onChange={(e) => setDraft({ ...draft, stemming: e.target.checked })} className="accent-brand" /> Stemming
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} className="accent-brand" /> Active
        </label>
      </div>
      <div className="flex gap-2 md:col-span-2">
        <button type="button" onClick={save} disabled={busy} className="btn-primary px-5 py-2 text-sm disabled:opacity-50">
          {busy ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={() => setEditing(null)} disabled={busy} className="neu-btn px-5 py-2 text-sm">
          Cancel
        </button>
      </div>
    </div>
  );

  const columns: GridColumn<SourceAdmin>[] = [
    {
      key: "site",
      header: "Site",
      width: "220px",
      sortable: true,
      param: "q",
      filter: { type: "text", placeholder: "Site or URL…" },
      render: (s) => (
        <div className="min-w-0 max-w-[260px]">
          <button
            type="button"
            onClick={() => toggleOpen(s.id)}
            aria-expanded={expanded === s.id}
            className="block max-w-full truncate text-left font-medium hover:text-brand"
            title={`${s.url} (show the listing pages)`}
          >
            {sourceName(s.site)}
          </button>
          <div className="truncate text-xs text-ink-faint">
            {s.site !== sourceName(s.site) ? `${s.site} · ` : ""}
            {s.url}
          </div>
        </div>
      ),
    },
    {
      key: "lang",
      header: "Language",
      width: "110px",
      sortable: true,
      filter: {
        type: "select",
        options: [
          { value: "id", label: "Indonesian" },
          { value: "en", label: "English" },
          { value: "ms", label: "Malay" },
          { value: "none", label: "Unknown" },
        ],
      },
      render: (s) => <span className="text-xs text-ink-muted">{LANG_NAME[s.lang] ?? s.lang}</span>,
    },
    {
      key: "description",
      header: "Description",
      className: "min-w-[200px]",
      render: (s) => (
        <div className="line-clamp-2 text-xs text-ink-muted" title={s.description}>
          {s.description || "—"}
        </div>
      ),
    },
    {
      key: "flags",
      header: "Flags",
      width: "170px",
      render: (s) => (
        <div className="text-xs text-ink-faint">
          <div className="truncate">page {s.htmlPage ? <code className="font-mono">{s.htmlPage}</code> : "—"}</div>
          <div>
            header {s.header ? "yes" : "no"} · stemming {s.stemming ? "yes" : "no"}
          </div>
          {s.socialMedia && <div className="truncate">social {s.socialMedia}</div>}
        </div>
      ),
    },
    {
      key: "labeled",
      header: "Labeled",
      width: "90px",
      align: "right",
      sortable: true,
      render: (s) => <span className="tabular-nums text-xs">{formatCount(s.labeled)}</span>,
    },
    {
      key: "unlabeled",
      header: "Unlabeled",
      width: "100px",
      align: "right",
      sortable: true,
      render: (s) => <span className="tabular-nums text-xs text-ink-muted">{formatCount(s.unlabeled)}</span>,
    },
    {
      key: "articles",
      header: "Articles",
      width: "90px",
      align: "right",
      sortable: true,
      render: (s) => <span className="tabular-nums text-xs">{formatCount(s.articles)}</span>,
    },
    {
      key: "status",
      header: "Status",
      width: "120px",
      filter: {
        type: "select",
        options: [
          { value: "active", label: "Active" },
          { value: "inactive", label: "Inactive" },
          { value: "offline", label: "Offline" },
        ],
      },
      render: (s) => (
        <div className="flex flex-wrap gap-1">
          <span className={clsx(chip, s.active ? "bg-verdict-valid/10 text-verdict-valid" : "bg-surface-sunken text-ink-faint")}>{s.active ? "active" : "inactive"}</span>
          {s.offline && <span className={clsx(chip, "bg-verdict-hoax/10 text-verdict-hoax")}>offline</span>}
        </div>
      ),
    },
    {
      key: "origin",
      header: "Origin",
      width: "120px",
      filter: {
        type: "select",
        options: [
          { value: "legacy", label: "Legacy" },
          { value: "site", label: "Added here" },
        ],
      },
      render: (s) => <span className={clsx(chip, "bg-surface-sunken text-ink-faint")}>{s.origin === "legacy" ? "legacy" : "added here"}</span>,
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      width: "220px",
      align: "right",
      render: (s) => (
        <div className="flex justify-end gap-1.5">
          <button type="button" onClick={() => (editing === s.id ? setEditing(null) : startEdit(s))} aria-pressed={editing === s.id} className={pill}>
            {editing === s.id ? "Close" : "Edit"}
          </button>
          <button type="button" onClick={() => toggleActive(s)} disabled={busy} className={pill}>
            {s.active ? "Deactivate" : "Activate"}
          </button>
          {s.origin === "site" && (
            <button type="button" onClick={() => remove(s)} disabled={busy} className={clsx(pill, "text-verdict-hoax hover:bg-verdict-hoax/10")}>
              Delete
            </button>
          )}
        </div>
      ),
    },
  ];

  function renderExpanded(s: SourceAdmin) {
    if (editing === s.id) {
      return (
        <section aria-label={`Edit ${sourceName(s.site)}`}>
          <h2 className="mb-3 text-sm font-semibold">Edit {sourceName(s.site)}</h2>
          {form}
        </section>
      );
    }
    const queue = crawlQueue.filter((q) => q.sourceId === s.id);
    return (
      <section aria-label={`Listing pages of ${s.site}`}>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold">Listing pages the old crawler used for {sourceName(s.site)}</h2>
          <button type="button" onClick={() => setOpen(null)} className="ml-auto neu-btn px-3 py-1 text-xs">
            Close ×
          </button>
        </div>
        {queue.length === 0 ? (
          <p className="mt-2 text-xs text-ink-muted">The old crawler had no listing pages for this site.</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-ink-faint">
                <tr>
                  {["URL", "Page", "Last page", "Suffix", "Status"].map((h) => (
                    <th key={h} className="pb-1 pr-3 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {queue.map((q) => (
                  <tr key={q.id} className="border-t border-hairline">
                    <td className="max-w-md truncate py-1 pr-3 font-mono" title={q.url}>
                      {q.url}
                    </td>
                    <td className="pr-3 tabular-nums">{q.page}</td>
                    <td className="pr-3 tabular-nums">{q.lastPage || "—"}</td>
                    <td className="pr-3 font-mono">{q.suffix || "—"}</td>
                    <td>{q.status || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <div ref={panelRef} className="scroll-mt-20">
        {editing === "new" && (
          <section className="neu p-5" aria-label="Add a source">
            <h2 className="mb-3 text-sm font-semibold">Add a source</h2>
            {form}
          </section>
        )}
      </div>

      <DataGrid
        caption="Source sites"
        columns={columns}
        rows={rows}
        rowKey={(s) => String(s.id)}
        sort={sort}
        expandedKey={expanded === null ? null : String(expanded)}
        onToggleExpanded={(key) => toggleOpen(Number(key))}
        renderExpanded={renderExpanded}
        toolbar={
          <button type="button" onClick={() => startEdit()} className="btn-primary px-3 py-1.5 text-xs">
            + Add source
          </button>
        }
        emptyMessage="No sources match."
        dense
      />
    </div>
  );
}
