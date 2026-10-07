"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SettingLang, StopwordRow } from "@/lib/settings";

/** One language's stopword page: delete a word, add many at once. */
export function SettingsStopwords({ lang, items: initial }: { lang: SettingLang; items: StopwordRow[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  async function add() {
    if (!text.trim()) return;
    setBusy(true);
    setNote("");
    try {
      const res = await fetch("/api/admin/settings/stopwords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang, words: text }),
      });
      const data = (await res.json()) as { added?: number; error?: string };
      if (!res.ok) throw new Error(data.error);
      setNote(`Added ${data.added ?? 0} new word${data.added === 1 ? "" : "s"}.`);
      setText("");
      router.refresh();
    } catch (err) {
      alert(err instanceof Error && err.message ? err.message : "Failed to add.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(w: StopwordRow) {
    setItems((list) => list.filter((x) => x.id !== w.id));
    const res = await fetch(`/api/admin/settings/stopwords/${w.id}`, { method: "DELETE" });
    if (!res.ok) {
      setItems((list) => [...list, w].sort((a, b) => a.word.localeCompare(b.word)));
      alert("Failed to delete.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-4 space-y-4">
      {items.length === 0 ? (
        <p className="text-sm text-ink-muted">No words here yet.</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {items.map((w) => (
            <li key={w.id} className="flex items-center gap-1 rounded-full border border-hairline bg-surface-sunken pl-2.5 pr-1 text-xs">
              <span title={w.origin === "legacy" ? "From the old panel" : "Added here"}>{w.word}</span>
              <button onClick={() => remove(w)} aria-label={`Delete ${w.word}`} className="grid h-5 w-5 place-items-center rounded-full text-ink-faint hover:bg-verdict-hoax/10 hover:text-verdict-hoax">
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          placeholder="Add words, separated by commas or new lines"
          className="flex-1 rounded-lg border border-hairline bg-surface-sunken px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-brand/30"
        />
        <button onClick={add} disabled={busy || !text.trim()} className="btn-primary px-5 py-2.5 text-sm disabled:opacity-50">
          {busy ? "Adding…" : "Add words"}
        </button>
      </div>
      {note && <p className="text-xs text-ink-muted">{note}</p>}
    </div>
  );
}
