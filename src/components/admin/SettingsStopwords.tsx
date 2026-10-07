"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SettingLang, StopwordRow } from "@/lib/settings";
import { DataGrid, type GridColumn, type GridPaging } from "@/components/admin/DataGrid";

const chip = "rounded-full bg-surface-sunken px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-faint";

/** One language's stopwords on the panel grid: filter, sort, delete a word, add many at once. */
export function SettingsStopwords({
  lang,
  langName,
  items,
  paging,
  sort,
}: {
  lang: SettingLang;
  langName: string;
  items: StopwordRow[];
  paging: GridPaging;
  sort: { key: string; order: "asc" | "desc" };
}) {
  const router = useRouter();
  const [removed, setRemoved] = useState<ReadonlySet<number>>(new Set());
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
      setNote(`Added ${data.added ?? 0} new word${data.added === 1 ? "" : "s"} to ${langName}.`);
      setText("");
      router.refresh();
    } catch (err) {
      alert(err instanceof Error && err.message ? err.message : "Failed to add.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(w: StopwordRow) {
    setRemoved((s) => new Set(s).add(w.id));
    const res = await fetch(`/api/admin/settings/stopwords/${w.id}`, { method: "DELETE" });
    if (!res.ok) {
      setRemoved((s) => {
        const next = new Set(s);
        next.delete(w.id);
        return next;
      });
      alert("Failed to delete.");
      return;
    }
    router.refresh();
  }

  const columns: GridColumn<StopwordRow>[] = [
    {
      key: "word",
      header: "Word",
      sortable: true,
      param: "q",
      filter: { type: "text", placeholder: "Find a word…" },
      render: (w) => <span className="font-mono text-xs">{w.word}</span>,
    },
    {
      key: "origin",
      header: "Origin",
      width: "160px",
      sortable: true,
      filter: {
        type: "select",
        options: [
          { value: "legacy", label: "Old panel" },
          { value: "site", label: "Added here" },
        ],
      },
      render: (w) => <span className={chip}>{w.origin === "legacy" ? "old panel" : "added here"}</span>,
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      width: "100px",
      align: "right",
      render: (w) => (
        <button
          type="button"
          onClick={() => remove(w)}
          aria-label={`Delete ${w.word}`}
          className="rounded-full border border-hairline px-3 py-1 text-xs font-medium text-verdict-hoax hover:bg-verdict-hoax/10"
        >
          Delete
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <DataGrid
        caption={`${langName} stopwords`}
        columns={columns}
        rows={items.filter((w) => !removed.has(w.id))}
        rowKey={(w) => String(w.id)}
        paging={paging}
        pageSizes={[50, 100, 250, 500]}
        sort={sort}
        emptyMessage="No words here yet."
        dense
      />
      <div className="neu p-4">
        <label htmlFor="stopwords-add" className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
          Add {langName} words
        </label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-start">
          <textarea
            id="stopwords-add"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            placeholder="Separate words with commas or new lines"
            className="flex-1 rounded-lg border border-hairline bg-surface-sunken px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-brand/30"
          />
          <button type="button" onClick={add} disabled={busy || !text.trim()} className="btn-primary px-5 py-2.5 text-sm disabled:opacity-50">
            {busy ? "Adding…" : "Add words"}
          </button>
        </div>
        {note && (
          <p className="mt-2 text-xs text-ink-muted" role="status">
            {note}
          </p>
        )}
      </div>
    </div>
  );
}
