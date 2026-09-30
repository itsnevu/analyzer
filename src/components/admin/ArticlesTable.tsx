"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ArticleListItem } from "@/lib/data";
import { VERDICT_META } from "@/lib/verdict";
import { LANGUAGE_NAME, formatDate, sourceName } from "@/lib/sources";

export function ArticlesTable({ articles }: { articles: ArticleListItem[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function remove(slug: string, title: string) {
    if (!confirm(`Delete article "${title}"? This cannot be undone.`)) return;
    setBusy(slug);
    try {
      const res = await fetch(`/api/admin/articles/${slug}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      alert("Failed to delete.");
    } finally {
      setBusy(null);
    }
  }

  if (articles.length === 0) {
    return (
      <div className="neu p-10 text-center text-sm text-ink-muted">
        No articles match. <Link href="/admin/articles/new" className="text-brand hover:underline">Add one →</Link>
      </div>
    );
  }

  return (
    <div className="neu overflow-hidden p-0">
      <div className="hidden grid-cols-[1fr_110px_100px_110px] gap-3 border-b border-hairline px-5 py-3 text-xs font-semibold uppercase tracking-wider text-ink-faint md:grid">
        <span>Title</span>
        <span>Verdict</span>
        <span>Date</span>
        <span className="text-right">Actions</span>
      </div>
      <ul className="divide-y divide-hairline">
        {articles.map((a) => {
          const m = VERDICT_META[a.verdict];
          return (
            <li key={a.slug} className="grid grid-cols-1 gap-2 px-5 py-4 md:grid-cols-[1fr_110px_100px_110px] md:items-center md:gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{a.title}</span>
                  {!a.published && (
                    <span className="shrink-0 rounded-full bg-surface-sunken px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-faint">
                      hidden
                    </span>
                  )}
                </div>
                <div className="truncate text-xs text-ink-faint">
                  {[LANGUAGE_NAME[a.lang], a.category, a.sourceSite && sourceName(a.sourceSite)].filter(Boolean).join(" · ")}
                </div>
              </div>
              <span className="text-xs font-semibold" style={{ color: m.color }}>{m.labelEn}</span>
              <span className="text-xs text-ink-muted">{formatDate(a.date) || "—"}</span>
              <div className="flex gap-2 md:justify-end">
                <Link
                  href={`/admin/articles/${a.slug}/edit`}
                  className="rounded-full border border-hairline px-3 py-1.5 text-xs font-medium hover:border-ink"
                >
                  Edit
                </Link>
                <button
                  onClick={() => remove(a.slug, a.title)}
                  disabled={busy === a.slug}
                  className="rounded-full border border-hairline px-3 py-1.5 text-xs font-medium text-verdict-hoax hover:bg-verdict-hoax/10 disabled:opacity-50"
                >
                  {busy === a.slug ? "…" : "Delete"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
