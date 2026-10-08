"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { CrawlQueueRow, SourceAdmin, SourceInput } from "@/lib/sources-admin";
import { sourceName } from "@/lib/sources";
import { clsx } from "@/lib/clsx";
import { DataGrid, type GridColumn } from "@/components/admin/DataGrid";
import { useAdminT } from "@/components/admin/AdminLang";
import { formatAdminNumber, tk } from "@/lib/admin-lang";

const LANG_NAME: Record<string, string> = { en: tk("English"), id: tk("Indonesian"), ms: tk("Malay") };
const field = "w-full rounded-lg border border-hairline bg-surface-sunken px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-brand/30";
const chip = "rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider";
const pill = "whitespace-nowrap rounded-full border border-hairline px-3 py-1 text-sm font-medium hover:border-ink disabled:opacity-50";

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
  const { t, lang } = useAdminT();
  const n = (v: number) => formatAdminNumber(v, lang);
  const yesNo = (v: boolean) => (v ? t("Yes") : t("No"));
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
      alert(err instanceof Error && err.message ? err.message : t("Could not save. Please try again."));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (editing === null) return;
    if (!draft.url.trim()) return alert(t("Please enter the site address (URL)."));
    if (await put(editing, draft)) setEditing(null);
  }

  async function toggleActive(s: SourceAdmin) {
    if (s.active && !confirm(t("Turn off {site}? Its pages will no longer be collected.", { site: s.site }))) return;
    await put(s.id, { ...toInput(s), active: !s.active });
  }

  async function remove(s: SourceAdmin) {
    if (!confirm(t("Delete the source {site}?", { site: s.site }))) return;
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
      alert(err instanceof Error && err.message ? err.message : t("Could not delete it. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  const form = (
    <div className="grid gap-3 md:grid-cols-2">
      <label className="text-sm text-ink-muted md:col-span-2">
        {t("Site address (URL)")}
        <input value={draft.url} onChange={(e) => setDraft({ ...draft, url: e.target.value })} placeholder={"https://example.com/"} className={clsx(field, "mt-1")} />
      </label>
      <label className="text-sm text-ink-muted">
        {t("Language")}
        <select value={draft.lang} onChange={(e) => setDraft({ ...draft, lang: e.target.value })} className={clsx(field, "mt-1")}>
          <option value="en">{t("English")}</option>
          <option value="id">{t("Indonesian")}</option>
          <option value="ms">{t("Malay")}</option>
          <option value="">{t("Unknown")}</option>
        </select>
      </label>
      <label className="text-sm text-ink-muted">
        {t("List page (path of the page that lists the fact-checks)")}
        <input value={draft.htmlPage} onChange={(e) => setDraft({ ...draft, htmlPage: e.target.value })} className={clsx(field, "mt-1")} />
      </label>
      <label className="text-sm text-ink-muted md:col-span-2">
        {t("Description")}
        <textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} rows={2} className={clsx(field, "mt-1")} />
      </label>
      <label className="text-sm text-ink-muted">
        {t("Social media")}
        <input value={draft.socialMedia} onChange={(e) => setDraft({ ...draft, socialMedia: e.target.value })} placeholder={t("yes / no / account name")} className={clsx(field, "mt-1")} />
      </label>
      <div className="flex flex-wrap items-end gap-4 text-sm">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={draft.header} onChange={(e) => setDraft({ ...draft, header: e.target.checked })} className="accent-brand" /> {t("Keep the page header")}
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={draft.stemming} onChange={(e) => setDraft({ ...draft, stemming: e.target.checked })} className="accent-brand" /> {t("Stemming (cut words down to their root)")}
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} className="accent-brand" /> {t("Active")}
        </label>
      </div>
      <div className="flex gap-2 md:col-span-2">
        <button type="button" onClick={save} disabled={busy} className="btn-primary px-5 py-2 text-sm disabled:opacity-50">
          {busy ? t("Saving…") : t("Save")}
        </button>
        <button type="button" onClick={() => setEditing(null)} disabled={busy} className="neu-btn px-5 py-2 text-sm">
          {t("Cancel")}
        </button>
      </div>
    </div>
  );

  const columns: GridColumn<SourceAdmin>[] = [
    {
      key: "site",
      header: t("Site"),
      width: "220px",
      sortable: true,
      param: "q",
      filter: { type: "text", placeholder: t("Site or URL…") },
      render: (s) => (
        <div className="min-w-0 max-w-[260px]">
          <button
            type="button"
            onClick={() => toggleOpen(s.id)}
            aria-expanded={expanded === s.id}
            className="block max-w-full truncate text-left font-medium hover:text-brand"
            title={t("{url} (show the list pages)", { url: s.url })}
          >
            {sourceName(s.site)}
          </button>
          <div className="truncate text-sm text-ink-faint">
            {s.site !== sourceName(s.site) ? `${s.site} · ` : ""}
            {s.url}
          </div>
        </div>
      ),
    },
    {
      key: "lang",
      header: t("Language"),
      width: "110px",
      sortable: true,
      filter: {
        type: "select",
        options: [
          { value: "id", label: t("Indonesian") },
          { value: "en", label: t("English") },
          { value: "ms", label: t("Malay") },
          { value: "none", label: t("Unknown") },
        ],
      },
      render: (s) => <span className="text-sm text-ink-muted">{LANG_NAME[s.lang] ? t(LANG_NAME[s.lang]) : s.lang || "—"}</span>,
    },
    {
      key: "description",
      header: t("Description"),
      className: "min-w-[200px]",
      render: (s) => (
        <div className="line-clamp-2 text-sm text-ink-muted" title={s.description}>
          {s.description || "—"}
        </div>
      ),
    },
    {
      key: "flags",
      header: t("Crawler settings"),
      width: "190px",
      render: (s) => (
        <div className="text-sm text-ink-faint">
          <div className="truncate">
            {t("List page:")} {s.htmlPage ? <code className="font-mono text-xs">{s.htmlPage}</code> : "—"}
          </div>
          <div>{t("Header: {header} · Stemming: {stemming}", { header: yesNo(s.header), stemming: yesNo(s.stemming) })}</div>
          {s.socialMedia && <div className="truncate">{t("Social media: {value}", { value: s.socialMedia })}</div>}
        </div>
      ),
    },
    {
      key: "labeled",
      header: t("Labeled"),
      width: "100px",
      align: "right",
      sortable: true,
      render: (s) => <span className="tabular-nums text-sm">{n(s.labeled)}</span>,
    },
    {
      key: "unlabeled",
      header: t("Unlabeled"),
      width: "120px",
      align: "right",
      sortable: true,
      render: (s) => <span className="tabular-nums text-sm text-ink-muted">{n(s.unlabeled)}</span>,
    },
    {
      key: "articles",
      header: t("Articles"),
      width: "90px",
      align: "right",
      sortable: true,
      render: (s) => <span className="tabular-nums text-sm">{n(s.articles)}</span>,
    },
    {
      key: "status",
      header: t("Status"),
      width: "120px",
      filter: {
        type: "select",
        options: [
          { value: "active", label: t("Active") },
          { value: "inactive", label: t("Inactive") },
          { value: "offline", label: t("Offline") },
        ],
      },
      render: (s) => (
        <div className="flex flex-wrap gap-1">
          <span className={clsx(chip, s.active ? "bg-verdict-valid/10 text-verdict-valid" : "bg-surface-sunken text-ink-faint")}>{s.active ? t("Active") : t("Inactive")}</span>
          {s.offline && <span className={clsx(chip, "bg-verdict-hoax/10 text-verdict-hoax")}>{t("Offline")}</span>}
        </div>
      ),
    },
    {
      key: "origin",
      header: t("Where from"),
      width: "120px",
      filter: {
        type: "select",
        options: [
          { value: "legacy", label: t("Old panel") },
          { value: "site", label: t("Added here") },
        ],
      },
      render: (s) => <span className={clsx(chip, "bg-surface-sunken text-ink-faint")}>{s.origin === "legacy" ? t("Old panel") : t("Added here")}</span>,
    },
    {
      key: "actions",
      header: <span className="sr-only">{t("Actions")}</span>,
      width: "220px",
      align: "right",
      render: (s) => (
        <div className="flex justify-end gap-1.5">
          <button type="button" onClick={() => (editing === s.id ? setEditing(null) : startEdit(s))} aria-pressed={editing === s.id} className={pill}>
            {editing === s.id ? t("Close") : t("Edit")}
          </button>
          <button type="button" onClick={() => toggleActive(s)} disabled={busy} className={pill}>
            {s.active ? t("Turn off") : t("Turn on")}
          </button>
          {s.origin === "site" && (
            <button type="button" onClick={() => remove(s)} disabled={busy} className={clsx(pill, "text-verdict-hoax hover:bg-verdict-hoax/10")}>
              {t("Delete")}
            </button>
          )}
        </div>
      ),
    },
  ];

  function renderExpanded(s: SourceAdmin) {
    if (editing === s.id) {
      return (
        <section aria-label={t("Edit {site}", { site: sourceName(s.site) })}>
          <h2 className="mb-3 text-sm font-semibold">{t("Edit {site}", { site: sourceName(s.site) })}</h2>
          {form}
        </section>
      );
    }
    const queue = crawlQueue.filter((q) => q.sourceId === s.id);
    return (
      <section aria-label={t("List pages of {site}", { site: s.site })}>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold">{t("List pages the old crawler read for {site}", { site: sourceName(s.site) })}</h2>
          <button type="button" onClick={() => setOpen(null)} className="ml-auto neu-btn px-3 py-1 text-sm">
            {t("Close")} ×
          </button>
        </div>
        {queue.length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">{t("The old crawler had no list pages for this site.")}</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-ink-faint">
                <tr>
                  {["URL", t("Page"), t("Last page"), t("URL ending"), t("Status")].map((h) => (
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
          <section className="neu p-5" aria-label={t("Add a source")}>
            <h2 className="mb-3 text-sm font-semibold">{t("Add a source")}</h2>
            {form}
          </section>
        )}
      </div>

      <DataGrid
        caption={t("Source sites")}
        columns={columns}
        rows={rows}
        rowKey={(s) => String(s.id)}
        sort={sort}
        expandedKey={expanded === null ? null : String(expanded)}
        onToggleExpanded={(key) => toggleOpen(Number(key))}
        renderExpanded={renderExpanded}
        toolbar={
          <button type="button" onClick={() => startEdit()} className="btn-primary px-3 py-1.5 text-sm">
            + {t("Add a source")}
          </button>
        }
        emptyMessage={t("No sources match these filters.")}
        dense
      />
    </div>
  );
}
