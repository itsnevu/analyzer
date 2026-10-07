"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SearchRow } from "@/lib/searches";
import { VERDICT_META } from "@/lib/verdict";
import { clsx } from "@/lib/clsx";

type Item = SearchRow & { when: string };

/** The search log with a delete button per row; `when` is the time already formatted in WIB. */
export function SearchesTable({ items: initial }: { items: Item[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [busy, setBusy] = useState<number | null>(null);

  async function remove(r: Item) {
    if (!confirm("Delete this search from the log?")) return;
    setBusy(r.id);
    try {
      const res = await fetch(`/api/admin/searches/${r.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setItems((list) => list.filter((x) => x.id !== r.id));
      router.refresh();
    } catch {
      alert("Failed to delete.");
    } finally {
      setBusy(null);
    }
  }

  if (items.length === 0) {
    return <div className="neu p-10 text-center text-sm text-ink-muted">No searches match.</div>;
  }

  const grid = "md:grid-cols-[1fr_100px_90px_150px_80px]";
  return (
    <div className="neu overflow-hidden p-0">
      <div className={clsx("hidden gap-3 border-b border-hairline px-5 py-3 text-xs font-semibold uppercase tracking-wider text-ink-faint md:grid", grid)}>
        <span>Query</span>
        <span>Verdict</span>
        <span>Origin</span>
        <span>Time (WIB)</span>
        <span className="text-right">Actions</span>
      </div>
      <ul className="divide-y divide-hairline">
        {items.map((r) => {
          const isLink = /^https?:\/\//i.test(r.query);
          const m = r.verdict && r.verdict in VERDICT_META ? VERDICT_META[r.verdict as keyof typeof VERDICT_META] : null;
          return (
            <li key={r.id} className={clsx("grid grid-cols-1 gap-2 px-5 py-3 md:items-center md:gap-3", grid)}>
              <div className="min-w-0 text-sm" title={r.query}>
                {isLink ? (
                  <a href={r.query} target="_blank" rel="noopener noreferrer" className="line-clamp-2 break-all text-brand hover:underline">{r.query}</a>
                ) : (
                  <span className="line-clamp-2 break-words">{r.query}</span>
                )}
              </div>
              <span className="text-xs font-semibold" style={m ? { color: m.color } : undefined}>{m ? m.labelEn : <span className="font-normal text-ink-faint">—</span>}</span>
              <span className="text-xs text-ink-muted">{r.origin === "legacy" ? "Legacy" : "This site"}</span>
              <span className="text-xs text-ink-muted">{r.when}</span>
              <div className="flex md:justify-end">
                <button
                  onClick={() => remove(r)}
                  disabled={busy === r.id}
                  className="rounded-full border border-hairline px-3 py-1.5 text-xs font-medium text-verdict-hoax hover:bg-verdict-hoax/10 disabled:opacity-50"
                >
                  {busy === r.id ? "…" : "Delete"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
