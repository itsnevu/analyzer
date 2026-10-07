"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CrawlQueueRow, SourceAdmin, SourceInput } from "@/lib/sources-admin";
import { formatCount, sourceName } from "@/lib/sources";
import { clsx } from "@/lib/clsx";

const LANG_NAME: Record<string, string> = { en: "English", id: "Indonesian", ms: "Malay", "": "—" };
const field = "w-full rounded-lg border border-hairline bg-surface-sunken px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-brand/30";
const chip = "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider";

const blank = (): SourceInput => ({ url: "", lang: "id", description: "", htmlPage: "", header: false, stemming: false, socialMedia: "", active: true });
const toInput = (s: SourceAdmin): SourceInput => ({
  url: s.url, lang: s.lang, description: s.description, htmlPage: s.htmlPage, header: s.header, stemming: s.stemming, socialMedia: s.socialMedia, active: s.active,
});

/** Source sites with counts; a row opens to show the old crawler's listing pages or an edit form. */
export function SourcesTable({ sources: initial, crawlQueue }: { sources: SourceAdmin[]; crawlQueue: CrawlQueueRow[] }) {
  const router = useRouter();
  const [sources, setSources] = useState(initial);
  const [open, setOpen] = useState<number | null>(null);
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [draft, setDraft] = useState<SourceInput>(blank());
  const [busy, setBusy] = useState(false);

  const queueOf = (id: number) => crawlQueue.filter((q) => q.sourceId === id);

  function startEdit(s?: SourceAdmin) {
    setDraft(s ? toInput(s) : blank());
    setEditing(s ? s.id : "new");
    if (s) setOpen(s.id);
  }

  async function save() {
    if (!draft.url.trim()) return alert("A site URL is required.");
    setBusy(true);
    try {
      const res = await fetch(editing === "new" ? "/api/admin/sources" : `/api/admin/sources/${editing}`, {
        method: editing === "new" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = (await res.json()) as { source?: SourceAdmin; error?: string };
      if (!res.ok || !data.source) throw new Error(data.error);
      const saved = data.source;
      setSources((list) => (editing === "new" ? [saved, ...list] : list.map((s) => (s.id === saved.id ? saved : s))));
      setEditing(null);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error && err.message ? err.message : "Failed to save.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(s: SourceAdmin) {
    if (!confirm(`Delete source "${s.site}"?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/sources/${s.id}`, { method: "DELETE" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error);
      setSources((list) => list.filter((x) => x.id !== s.id));
      router.refresh();
    } catch (err) {
      alert(err instanceof Error && err.message ? err.message : "Failed to delete.");
    } finally {
      setBusy(false);
    }
  }

  const form = (
    <div className="grid gap-3 bg-surface-sunken/40 p-5 md:grid-cols-2">
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
        <label className="flex items-center gap-1.5"><input type="checkbox" checked={draft.header} onChange={(e) => setDraft({ ...draft, header: e.target.checked })} /> Keep page header</label>
        <label className="flex items-center gap-1.5"><input type="checkbox" checked={draft.stemming} onChange={(e) => setDraft({ ...draft, stemming: e.target.checked })} /> Stemming</label>
        <label className="flex items-center gap-1.5"><input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} /> Active</label>
      </div>
      <div className="flex gap-2 md:col-span-2">
        <button onClick={save} disabled={busy} className="btn-primary px-5 py-2 text-sm disabled:opacity-50">{busy ? "Saving…" : "Save"}</button>
        <button onClick={() => setEditing(null)} disabled={busy} className="neu-btn px-5 py-2 text-sm">Cancel</button>
      </div>
    </div>
  );

  const grid = "md:grid-cols-[minmax(0,1.4fr)_80px_minmax(0,1.6fr)_120px_140px_130px]";
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={() => startEdit()} className="btn-primary px-5 py-2.5 text-sm">+ Add source</button>
      </div>
      <div className="neu overflow-hidden p-0">
        {editing === "new" && <div className="border-b border-hairline">{form}</div>}
        <div className={clsx("hidden gap-3 border-b border-hairline px-5 py-3 text-xs font-semibold uppercase tracking-wider text-ink-faint md:grid", grid)}>
          <span>Site</span>
          <span>Language</span>
          <span>Description · page · flags</span>
          <span>Dataset</span>
          <span>Archive · status</span>
          <span className="text-right">Actions</span>
        </div>
        <ul className="divide-y divide-hairline">
          {sources.map((s) => {
            const queue = queueOf(s.id);
            const expanded = open === s.id;
            return (
              <li key={s.id}>
                <div className={clsx("grid grid-cols-1 gap-2 px-5 py-3 md:items-center md:gap-3", grid)}>
                  <div className="min-w-0">
                    <button onClick={() => setOpen(expanded ? null : s.id)} className="block max-w-full truncate text-left text-sm font-medium hover:text-brand" title={s.url}>
                      {expanded ? "▾" : "▸"} {sourceName(s.site)}
                    </button>
                    <div className="truncate text-xs text-ink-faint">{s.site !== sourceName(s.site) ? `${s.site} · ` : ""}{s.url}</div>
                  </div>
                  <span className="text-xs text-ink-muted">{LANG_NAME[s.lang] ?? s.lang}</span>
                  <div className="min-w-0 text-xs text-ink-muted">
                    <div className="truncate" title={s.description}>{s.description || "—"}</div>
                    <div className="truncate text-ink-faint">
                      page {s.htmlPage ? <code className="font-mono">{s.htmlPage}</code> : "—"} · header {s.header ? "yes" : "no"} · stemming {s.stemming ? "yes" : "no"}
                      {s.socialMedia ? ` · social ${s.socialMedia}` : ""}
                    </div>
                  </div>
                  <div className="text-xs text-ink-muted">
                    <div>{formatCount(s.labeled)} labeled</div>
                    <div className="text-ink-faint">{formatCount(s.unlabeled)} unlabeled</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1 text-xs text-ink-muted">
                    <span className="mr-1">{formatCount(s.articles)} articles</span>
                    <span className={clsx(chip, s.active ? "bg-verdict-valid/10 text-verdict-valid" : "bg-surface-sunken text-ink-faint")}>{s.active ? "active" : "inactive"}</span>
                    {s.offline && <span className={clsx(chip, "bg-verdict-hoax/10 text-verdict-hoax")}>offline</span>}
                    <span className={clsx(chip, "bg-surface-sunken text-ink-faint")}>{s.origin === "legacy" ? "legacy" : "added here"}</span>
                  </div>
                  <div className="flex gap-2 md:justify-end">
                    <button onClick={() => startEdit(s)} className="rounded-full border border-hairline px-3 py-1.5 text-xs font-medium hover:border-ink">Edit</button>
                    {s.origin === "site" && (
                      <button onClick={() => remove(s)} disabled={busy} className="rounded-full border border-hairline px-3 py-1.5 text-xs font-medium text-verdict-hoax hover:bg-verdict-hoax/10 disabled:opacity-50">
                        Delete
                      </button>
                    )}
                  </div>
                </div>
                {editing === s.id && <div className="border-t border-hairline">{form}</div>}
                {expanded && editing !== s.id && (
                  <div className="border-t border-hairline bg-surface-sunken/40 px-5 py-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-faint">Listing pages the old crawler used</h3>
                    {queue.length === 0 ? (
                      <p className="mt-2 text-xs text-ink-muted">The old crawler had no listing pages for this site.</p>
                    ) : (
                      <table className="mt-2 w-full text-left text-xs">
                        <thead className="text-ink-faint">
                          <tr>{["URL", "Page", "Last page", "Suffix", "Status"].map((h) => <th key={h} className="pb-1 pr-3 font-medium">{h}</th>)}</tr>
                        </thead>
                        <tbody>
                          {queue.map((q) => (
                            <tr key={q.id} className="border-t border-hairline">
                              <td className="max-w-md truncate py-1 pr-3 font-mono" title={q.url}>{q.url}</td>
                              <td className="pr-3 tabular-nums">{q.page}</td>
                              <td className="pr-3 tabular-nums">{q.lastPage || "—"}</td>
                              <td className="pr-3 font-mono">{q.suffix || "—"}</td>
                              <td>{q.status || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
