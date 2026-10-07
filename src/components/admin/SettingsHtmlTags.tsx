"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { HtmlTagRow } from "@/lib/settings";
import { clsx } from "@/lib/clsx";
import { DataGrid, type GridColumn } from "@/components/admin/DataGrid";

const field = "h-7 rounded-md border border-hairline bg-surface-raised px-2 font-mono text-xs text-ink outline-none focus:ring-2 focus:ring-brand/30";
const pill = "whitespace-nowrap rounded-full border border-hairline px-3 py-1 text-xs font-medium hover:border-ink disabled:opacity-50";

/** How a stored tag is matched: entity names get their "&", anything else is replaced as it is. */
const shown = (tag: string) => (/^#?[a-z0-9]+;?$/i.test(tag) ? `&${tag}` : tag);

/** The entity → replacement table on the panel grid, with inline edit, add and delete. */
export function SettingsHtmlTags({ tags: initial }: { tags: HtmlTagRow[] }) {
  const router = useRouter();
  const [tags, setTags] = useState(initial);
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState({ tag: "", alt: "" });
  const [fresh, setFresh] = useState({ tag: "", alt: "" });
  const [busy, setBusy] = useState(false);

  async function send(url: string, method: string, body: { tag: string; alt: string }) {
    setBusy(true);
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = (await res.json()) as { tags?: HtmlTagRow[]; error?: string };
      if (!res.ok || !data.tags) throw new Error(data.error);
      setTags(data.tags);
      router.refresh();
      return true;
    } catch (err) {
      alert(err instanceof Error && err.message ? err.message : "Failed to save.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function save(id: number) {
    if (!draft.tag.trim()) return alert("The tag is required.");
    if (await send(`/api/admin/settings/html-tags/${id}`, "PUT", draft)) setEditing(null);
  }

  async function add() {
    if (!fresh.tag.trim()) return alert("The tag is required.");
    if (await send("/api/admin/settings/html-tags", "POST", fresh)) setFresh({ tag: "", alt: "" });
  }

  async function remove(t: HtmlTagRow) {
    if (!confirm(`Delete the replacement for "${t.tag}"?`)) return;
    setTags((list) => list.filter((x) => x.id !== t.id));
    const res = await fetch(`/api/admin/settings/html-tags/${t.id}`, { method: "DELETE" });
    if (!res.ok) {
      setTags((list) => [...list, t].sort((a, b) => a.id - b.id));
      alert("Failed to delete.");
      return;
    }
    router.refresh();
  }

  const columns: GridColumn<HtmlTagRow>[] = [
    {
      key: "tag",
      header: "Tag (as stored)",
      render: (t) =>
        editing === t.id ? (
          <input
            value={draft.tag}
            onChange={(e) => setDraft({ ...draft, tag: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && save(t.id)}
            className={field}
            aria-label="Tag"
            autoFocus
          />
        ) : (
          <span className="font-mono text-xs">{t.tag}</span>
        ),
    },
    {
      key: "matches",
      header: "Matches",
      render: (t) => <span className="font-mono text-xs text-ink-faint">{shown(editing === t.id ? draft.tag : t.tag)}</span>,
    },
    {
      key: "alt",
      header: "Replacement",
      render: (t) =>
        editing === t.id ? (
          <input
            value={draft.alt}
            onChange={(e) => setDraft({ ...draft, alt: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && save(t.id)}
            className={field}
            aria-label="Replacement"
          />
        ) : (
          <span className="font-mono text-xs">{t.alt === "" ? <span className="text-ink-faint">(removed)</span> : JSON.stringify(t.alt)}</span>
        ),
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      width: "160px",
      align: "right",
      render: (t) =>
        editing === t.id ? (
          <div className="flex justify-end gap-1.5">
            <button type="button" onClick={() => save(t.id)} disabled={busy} className="btn-primary px-3 py-1 text-xs disabled:opacity-50">
              Save
            </button>
            <button type="button" onClick={() => setEditing(null)} className={pill}>
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex justify-end gap-1.5">
            <button
              type="button"
              onClick={() => {
                setEditing(t.id);
                setDraft({ tag: t.tag, alt: t.alt });
              }}
              className={pill}
            >
              Edit
            </button>
            <button type="button" onClick={() => remove(t)} className={clsx(pill, "text-verdict-hoax hover:bg-verdict-hoax/10")}>
              Delete
            </button>
          </div>
        ),
    },
  ];

  return (
    <DataGrid
      caption={`${tags.length} replacements`}
      columns={columns}
      rows={tags}
      rowKey={(t) => String(t.id)}
      toolbar={
        <form
          className="flex flex-wrap items-center gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <input value={fresh.tag} onChange={(e) => setFresh({ ...fresh, tag: e.target.value })} placeholder="Tag, e.g. #8216;" className={clsx(field, "w-36")} aria-label="New tag" />
          <input value={fresh.alt} onChange={(e) => setFresh({ ...fresh, alt: e.target.value })} placeholder="Replacement" className={clsx(field, "w-32")} aria-label="New replacement" />
          <button type="submit" disabled={busy || !fresh.tag.trim()} className="btn-primary px-3 py-1 text-xs disabled:opacity-50">
            + Add
          </button>
        </form>
      }
      emptyMessage="No replacements yet."
      dense
    />
  );
}
