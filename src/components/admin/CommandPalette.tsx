"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { clsx } from "@/lib/clsx";
import { VERDICT_META } from "@/lib/verdict";
import type { ArticleListItem } from "@/lib/data";
import { ADMIN_NAV, type AdminLink } from "./admin-nav";
import { AdminIcon } from "./AdminIcons";

type Item =
  | { kind: "page"; link: AdminLink; group: string }
  | { kind: "article"; article: ArticleListItem }
  | { kind: "search"; q: string };

const PAGES: Item[] = ADMIN_NAV.flatMap((g) => g.links.map((link) => ({ kind: "page" as const, link, group: g.title })));

/**
 * Ctrl+K: jump to any admin page or straight to an article's edit form.
 * Article matches come from the admin list API after a short pause in typing.
 */
export function CommandPalette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  // Articles found for the query they were fetched with; shown only while that query is still typed.
  const [found, setFound] = useState<{ q: string; items: ArticleListItem[] }>({ q: "", items: [] });
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = window.setTimeout(() => inputRef.current?.focus(), 10);
    return () => window.clearTimeout(id);
  }, []);

  // Article lookup, debounced; an answer that arrives after the query changed is ignored by `found.q`.
  const needle = q.trim();
  useEffect(() => {
    if (needle.length < 2) return;
    const ctrl = new AbortController();
    const id = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/articles?q=${encodeURIComponent(needle)}&pageSize=25`, { signal: ctrl.signal });
        if (!res.ok) return;
        const json = (await res.json()) as { items: ArticleListItem[] };
        setFound({ q: needle, items: (json.items ?? []).slice(0, 6) });
      } catch {
        /* aborted or offline */
      }
    }, 180);
    return () => {
      ctrl.abort();
      window.clearTimeout(id);
    };
  }, [needle]);

  const items = useMemo<Item[]>(() => {
    const lower = needle.toLowerCase();
    const pages = lower ? PAGES.filter((p) => p.kind === "page" && `${p.link.label} ${p.link.hint} ${p.group}`.toLowerCase().includes(lower)) : PAGES;
    const articles = found.q === needle && needle.length >= 2 ? found.items : [];
    const list: Item[] = [...pages.slice(0, lower ? 6 : 20), ...articles.map((article) => ({ kind: "article" as const, article }))];
    if (needle.length >= 2) list.push({ kind: "search", q: needle });
    return list;
  }, [needle, found]);

  // The highlighted row never points past the list, whatever arrived since the last key press.
  const active = Math.min(cursor, Math.max(0, items.length - 1));
  const setActive = setCursor;

  function go(item: Item) {
    onClose();
    if (item.kind === "page") router.push(item.link.href);
    else if (item.kind === "article") router.push(`/admin/articles/${item.article.slug}/edit`);
    else router.push(`/admin/articles?q=${encodeURIComponent(item.q)}`);
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(items.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter" && items[active]) {
      e.preventDefault();
      go(items[active]);
    } else if (e.key === "Escape") {
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[12vh] backdrop-blur-sm" onMouseDown={onClose} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search the panel"
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-hairline bg-surface-raised shadow-neu-lg"
      >
        <div className="flex items-center gap-3 border-b border-hairline px-4">
          <svg viewBox="0 0 24 24" className="h-4 w-4 text-ink-faint" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setCursor(0);
            }}
            onKeyDown={onKey}
            placeholder="Go to a page or find an article…"
            aria-label="Search"
            aria-activedescendant={items[active] ? `cmd-${active}` : undefined}
            className="h-12 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
          />
          <kbd className="rounded border border-hairline px-1.5 font-mono text-[10px] text-ink-faint">Esc</kbd>
        </div>
        <ul role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
          {items.length === 0 && <li className="px-3 py-6 text-center text-sm text-ink-faint">Nothing matches.</li>}
          {items.map((item, i) => {
            const selected = i === active;
            const row = clsx("flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm", selected ? "bg-ink text-surface-raised" : "text-ink hover:bg-surface-sunken");
            if (item.kind === "page") {
              return (
                <li key={`p-${item.link.href}`} id={`cmd-${i}`} role="option" aria-selected={selected} className={row} onMouseEnter={() => setActive(i)} onClick={() => go(item)}>
                  <AdminIcon name={item.link.icon} className={clsx("h-4 w-4 shrink-0", selected ? "text-surface-raised" : "text-ink-faint")} />
                  <span className="min-w-0 flex-1 truncate">{item.link.label}</span>
                  <span className={clsx("truncate text-xs", selected ? "text-surface-raised/70" : "text-ink-faint")}>{item.group}</span>
                </li>
              );
            }
            if (item.kind === "article") {
              const m = VERDICT_META[item.article.verdict];
              return (
                <li key={`a-${item.article.slug}`} id={`cmd-${i}`} role="option" aria-selected={selected} className={row} onMouseEnter={() => setActive(i)} onClick={() => go(item)}>
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: m.color }} aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{item.article.title}</span>
                  <span className={clsx("shrink-0 text-xs", selected ? "text-surface-raised/70" : "text-ink-faint")}>{item.article.published ? "edit" : "hidden"}</span>
                </li>
              );
            }
            return (
              <li key="s" id={`cmd-${i}`} role="option" aria-selected={selected} className={row} onMouseEnter={() => setActive(i)} onClick={() => go(item)}>
                <AdminIcon name="search" className={clsx("h-4 w-4 shrink-0", selected ? "text-surface-raised" : "text-ink-faint")} />
                <span className="truncate">Search all articles for “{item.q}”</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
