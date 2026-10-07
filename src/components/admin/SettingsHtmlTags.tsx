"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { HtmlTagRow } from "@/lib/settings";

const field = "rounded-lg border border-hairline bg-surface-sunken px-2.5 py-1.5 font-mono text-xs text-ink outline-none focus:ring-2 focus:ring-brand/30";

/** The entity → replacement table with inline editing. */
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

  const shown = (tag: string) => (/^#?[a-z0-9]+;?$/i.test(tag) ? `&${tag}` : tag);

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-xs text-ink-faint">
          <tr>
            <th className="pb-2 pr-3 font-medium">Tag (as stored)</th>
            <th className="pb-2 pr-3 font-medium">Matches</th>
            <th className="pb-2 pr-3 font-medium">Replacement</th>
            <th className="pb-2 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {tags.map((t) =>
            editing === t.id ? (
              <tr key={t.id} className="border-t border-hairline">
                <td className="py-1.5 pr-3"><input value={draft.tag} onChange={(e) => setDraft({ ...draft, tag: e.target.value })} className={field} aria-label="Tag" /></td>
                <td className="pr-3 font-mono text-xs text-ink-faint">{shown(draft.tag)}</td>
                <td className="pr-3"><input value={draft.alt} onChange={(e) => setDraft({ ...draft, alt: e.target.value })} className={field} aria-label="Replacement" /></td>
                <td className="text-right">
                  <button onClick={() => save(t.id)} disabled={busy} className="mr-2 rounded-full bg-ink px-3 py-1 text-xs font-medium text-surface-raised disabled:opacity-50">Save</button>
                  <button onClick={() => setEditing(null)} className="rounded-full border border-hairline px-3 py-1 text-xs font-medium">Cancel</button>
                </td>
              </tr>
            ) : (
              <tr key={t.id} className="border-t border-hairline">
                <td className="py-1.5 pr-3 font-mono text-xs">{t.tag}</td>
                <td className="pr-3 font-mono text-xs text-ink-faint">{shown(t.tag)}</td>
                <td className="pr-3 font-mono text-xs">{t.alt === "" ? <span className="text-ink-faint">(removed)</span> : JSON.stringify(t.alt)}</td>
                <td className="whitespace-nowrap text-right">
                  <button onClick={() => { setEditing(t.id); setDraft({ tag: t.tag, alt: t.alt }); }} className="mr-2 rounded-full border border-hairline px-3 py-1 text-xs font-medium hover:border-ink">Edit</button>
                  <button onClick={() => remove(t)} className="rounded-full border border-hairline px-3 py-1 text-xs font-medium text-verdict-hoax hover:bg-verdict-hoax/10">Delete</button>
                </td>
              </tr>
            ),
          )}
          <tr className="border-t border-hairline">
            <td className="py-2 pr-3"><input value={fresh.tag} onChange={(e) => setFresh({ ...fresh, tag: e.target.value })} placeholder="#8216;" className={field} aria-label="New tag" /></td>
            <td className="pr-3 font-mono text-xs text-ink-faint">{fresh.tag ? shown(fresh.tag) : ""}</td>
            <td className="pr-3"><input value={fresh.alt} onChange={(e) => setFresh({ ...fresh, alt: e.target.value })} placeholder="'" className={field} aria-label="New replacement" /></td>
            <td className="text-right">
              <button onClick={add} disabled={busy || !fresh.tag.trim()} className="rounded-full bg-ink px-3 py-1 text-xs font-medium text-surface-raised disabled:opacity-50">Add</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
