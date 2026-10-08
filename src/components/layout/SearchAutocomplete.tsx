"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Verdict } from "@/lib/detect";
import { clsx } from "@/lib/clsx";
import { useI18n } from "@/lib/i18n";
import { formatDate, sourceName } from "@/lib/sources";
import { VERDICT_META } from "@/lib/verdict";
import { rich } from "@/components/ui/Rich";

/** One row of /api/suggest. */
export interface Suggestion {
  slug: string;
  title: string;
  verdict: Verdict;
  sourceSite: string;
  date: string;
}

const MIN_CHARS = 2;
const DEBOUNCE_MS = 200;
/** Long enough for a click on an option to land before the list closes. */
const BLUR_DELAY_MS = 150;

export function SearchIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Archive search box with suggestions. The form is a plain GET to /blog, so it
 * works before JavaScript loads; once it has, typing two characters or more
 * fetches matching fact-checks and lists them under the input (a combobox
 * with a listbox: arrow keys move, Enter opens, Escape closes). The list is
 * positioned over the page, so nothing moves when it opens or closes.
 */
export function SearchAutocomplete({ id, className, onDone }: { id: string; className?: string; onDone?: () => void }) {
  const router = useRouter();
  const { t, lang } = useI18n();
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  // Index of the highlighted option: the suggestions, then the "search the archive" row.
  const [active, setActive] = useState(-1);
  const timer = useRef<number>(undefined);
  const blurTimer = useRef<number>(undefined);
  const abort = useRef<AbortController | null>(null);

  const term = q.replace(/\s+/g, " ").trim();
  const canSuggest = term.length >= MIN_CHARS;
  const expanded = open && canSuggest;
  const count = items.length + 1;
  const listId = `${id}-listbox`;
  const optionId = (i: number) => `${id}-option-${i}`;

  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
      window.clearTimeout(blurTimer.current);
      abort.current?.abort();
    },
    [],
  );

  async function load(text: string) {
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    try {
      const res = await fetch(`/api/suggest?q=${encodeURIComponent(text)}`, { signal: ctrl.signal });
      if (!res.ok) return;
      const data = (await res.json()) as { suggestions?: Suggestion[] };
      if (!ctrl.signal.aborted) setItems(Array.isArray(data.suggestions) ? data.suggestions : []);
    } catch {
      /* aborted or offline; the plain form still works */
    }
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setQ(value);
    setActive(-1);
    window.clearTimeout(timer.current);
    const next = value.replace(/\s+/g, " ").trim();
    if (next.length < MIN_CHARS) {
      abort.current?.abort();
      setItems([]);
      setOpen(false);
      return;
    }
    setOpen(true);
    timer.current = window.setTimeout(() => void load(next), DEBOUNCE_MS);
  }

  function close() {
    setOpen(false);
    setActive(-1);
  }

  function choose(slug: string) {
    close();
    onDone?.();
    router.push(`/blog/${slug}`);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!canSuggest) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i + 1) % count);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i <= 0 ? count - 1 : i - 1));
    } else if (e.key === "Escape") {
      if (expanded) {
        e.preventDefault();
        close();
      }
    } else if (e.key === "Enter") {
      // A highlighted fact-check opens; otherwise the form submits the search.
      if (expanded && active >= 0 && active < items.length) {
        e.preventDefault();
        choose(items[active].slug);
      }
    }
  }

  return (
    <form
      action="/blog"
      method="get"
      role="search"
      onSubmit={() => {
        close();
        onDone?.();
      }}
      className={clsx("relative", className)}
    >
      <label className="sr-only" htmlFor={id}>
        {t("Search the fact-check archive")}
      </label>
      <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
      <input
        id={id}
        type="search"
        name="q"
        value={q}
        onChange={onChange}
        onKeyDown={onKeyDown}
        onFocus={() => {
          window.clearTimeout(blurTimer.current);
          if (canSuggest) setOpen(true);
        }}
        onBlur={() => {
          blurTimer.current = window.setTimeout(close, BLUR_DELAY_MS);
        }}
        placeholder={t("Search fact-checks…")}
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-activedescendant={expanded && active >= 0 ? optionId(active) : undefined}
        className="w-full rounded-full border border-hairline bg-surface-sunken py-2 pl-9 pr-3 text-sm text-ink outline-none placeholder:text-ink-faint focus:ring-2 focus:ring-brand/30"
      />

      {expanded && (
        <ul
          id={listId}
          role="listbox"
          aria-label={t("Suggested fact-checks")}
          // Keeps focus in the input while an option is clicked.
          onMouseDown={(e) => e.preventDefault()}
          className="absolute right-0 top-full z-50 mt-2 w-full min-w-[min(22rem,calc(100vw-3rem))] overflow-hidden rounded-xl border border-hairline bg-surface-raised p-1 shadow-neu-lg"
        >
          {items.map((s, i) => {
            const meta = VERDICT_META[s.verdict];
            const sub = [s.sourceSite && sourceName(s.sourceSite), formatDate(s.date, "short", lang)].filter(Boolean).join(" · ");
            return (
              <li key={s.slug} role="none">
                <Link
                  id={optionId(i)}
                  role="option"
                  aria-selected={active === i}
                  tabIndex={-1}
                  href={`/blog/${s.slug}`}
                  onClick={() => {
                    close();
                    onDone?.();
                  }}
                  onMouseEnter={() => setActive(i)}
                  className={clsx("flex items-start gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors", active === i && "bg-surface-sunken")}
                >
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: meta.color }} aria-hidden />
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-ink">{s.title}</span>
                    <span className="block truncate text-xs text-ink-faint">{[t(meta.labelEn), sub].filter(Boolean).join(" · ")}</span>
                  </span>
                </Link>
              </li>
            );
          })}
          <li role="none" className={clsx(items.length > 0 && "mt-1 border-t border-hairline pt-1")}>
            <button
              type="submit"
              id={optionId(items.length)}
              role="option"
              aria-selected={active === items.length}
              tabIndex={-1}
              onMouseEnter={() => setActive(items.length)}
              className={clsx(
                "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-ink-muted transition-colors",
                active === items.length && "bg-surface-sunken text-ink",
              )}
            >
              <SearchIcon className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">
                {/* The term goes in after the tags are read, so typed text is never taken for markup. */}
                {rich(t("Search the archive for <q>“{term}”</q>"), { q: (s) => <span className="font-medium text-ink">{s.replace("{term}", term)}</span> })}
              </span>
            </button>
          </li>
        </ul>
      )}
    </form>
  );
}
