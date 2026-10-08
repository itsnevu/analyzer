"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Article, ArticleListItem } from "@/lib/data";
import { slugify } from "@/lib/slug";
import { clsx } from "@/lib/clsx";
import { LANGUAGE_NAME, formatDate, sourceName } from "@/lib/sources";
import { VERDICT_META } from "@/lib/verdict";
import { CoverPlaceholder, VerdictBadge } from "@/components/article/ArticleCard";
import { useToast } from "./Toast";

const IMAGE_OPTIONS = [
  "/articles/clouds.jpg?v=2",
  "/articles/darkness.jpg?v=2",
  "/articles/scam.jpg?v=2",
  "/pages/detector.jpg?v=2",
  "/pages/about.jpg?v=2",
];

const field =
  "w-full rounded-lg border border-hairline bg-surface-sunken px-3.5 py-2.5 text-sm text-ink outline-none focus:ring-2 focus:ring-brand/30";
const labelCls = "mb-1.5 block text-xs font-medium text-ink-muted";
const pill =
  "whitespace-nowrap rounded-full border border-hairline px-3 py-1 text-xs font-medium transition-colors hover:border-ink disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40";

/** A summary longer than this no longer fits the card and the search snippet. */
const SUMMARY_LIMIT = 300;
const AUTOSAVE_MS = 800;
const DRAFT_PREFIX = "admin.articleDraft.";

type Draft = Omit<Article, "lang" | "verdict" | "published" | "originalUrl" | "sourceSite" | "archiveUrl"> & {
  lang: string;
  verdict: string;
  published: boolean;
  originalUrl: string;
  sourceSite: string;
};

/** The fields the save API takes, in a fixed order, so two drafts compare as strings. */
const FIELDS: (keyof Draft)[] = [
  "slug", "title", "lang", "category", "verdict", "date", "summaryId", "summaryEn", "source",
  "narration", "explanation", "reference", "image", "originalUrl", "sourceSite", "published",
];
const serialize = (d: Draft) => JSON.stringify(d, FIELDS as string[]);

function emptyDraft(): Draft {
  return {
    slug: "", title: "", lang: "id", category: "Misinformation", verdict: "misleading",
    date: new Date().toISOString().slice(0, 10),
    summaryId: "", summaryEn: "", source: "", narration: "", explanation: "", reference: "",
    image: "", originalUrl: "", sourceSite: "", published: true,
  };
}

function toDraft(a: Article): Draft {
  return {
    slug: a.slug, title: a.title, lang: a.lang, category: a.category, verdict: a.verdict, date: a.date,
    summaryId: a.summaryId, summaryEn: a.summaryEn, source: a.source, narration: a.narration,
    explanation: a.explanation, reference: a.reference, image: a.image,
    originalUrl: a.originalUrl ?? "", sourceSite: a.sourceSite ?? "", published: a.published !== false,
  };
}

/* -------------------------------------------------- local draft storage */

interface StoredDraft {
  at: string;
  draft: Draft;
}

function readStored(key: string, base: Draft): StoredDraft | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at?: unknown; draft?: Record<string, unknown> };
    if (typeof parsed.at !== "string" || !parsed.draft || typeof parsed.draft !== "object") return null;
    const draft = { ...base };
    for (const k of FIELDS) {
      const v = parsed.draft[k];
      if (k === "published") {
        if (typeof v === "boolean") draft.published = v;
      } else if (typeof v === "string") {
        (draft as Record<string, unknown>)[k] = v;
      }
    }
    return { at: parsed.at, draft };
  } catch {
    return null;
  }
}

function writeStored(key: string, draft: Draft): void {
  try {
    localStorage.setItem(key, JSON.stringify({ at: new Date().toISOString(), draft: JSON.parse(serialize(draft)) }));
  } catch {
    /* private mode or storage full */
  }
}

function removeStored(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* private mode */
  }
}

const stampLabel = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "earlier" : d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};

/* ----------------------------------------------------------- the form */

type Similar =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "done"; items: ArticleListItem[] };

/**
 * Add or edit an article: the form on the left, a live preview of the public
 * card and article on the right (stacked under it on narrower screens).
 * Unsaved work is guarded (leaving the page asks first), kept as a draft in
 * this browser, and saved with Ctrl/Cmd+S.
 */
export function ArticleForm({ initial, mode }: { initial?: Article; mode: "new" | "edit" }) {
  const router = useRouter();
  const toast = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  const [start] = useState<Draft>(() => (initial ? toDraft(initial) : emptyDraft()));
  const [d, setD] = useState<Draft>(start);
  // What the server has; the form is dirty while it differs.
  const [baseline, setBaseline] = useState(() => serialize(start));
  // The slug the server knows the article by; null until a new article is first saved.
  const [savedSlug, setSavedSlug] = useState<string | null>(mode === "edit" && initial ? initial.slug : null);
  const [slugTouched, setSlugTouched] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [offer, setOffer] = useState<StoredDraft | null>(null);
  const [similar, setSimilar] = useState<Similar>({ status: "idle" });

  const storageKey = `${DRAFT_PREFIX}${initial?.slug ?? "new"}`;
  const current = serialize(d);
  const dirty = current !== baseline;

  // A draft left in this browser by an earlier visit is offered once, after mount (storage is client-only).
  useEffect(() => {
    const stored = readStored(storageKey, start);
    if (!stored || serialize(stored.draft) === serialize(start)) return;
    const id = window.setTimeout(() => setOffer(stored), 0);
    return () => window.clearTimeout(id);
  }, [storageKey, start]);

  // Autosave the draft locally a moment after the last change.
  useEffect(() => {
    if (!dirty) return;
    const id = window.setTimeout(() => writeStored(storageKey, JSON.parse(current) as Draft), AUTOSAVE_MS);
    return () => window.clearTimeout(id);
  }, [current, dirty, storageKey]);

  // Closing the tab or reloading with unsaved changes asks first; so does following a link inside the panel.
  useEffect(() => {
    if (!dirty) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return; // a full page load; beforeunload asks
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      if (!window.confirm("You have unsaved changes. Leave this page? The draft stays in this browser.")) {
        e.preventDefault();
        e.stopPropagation();
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("click", onClick, true);
    };
  }, [dirty]);

  // Ctrl/Cmd+S saves, wherever the focus is.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        formRef.current?.requestSubmit();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function set<K extends keyof Draft>(k: K, v: Draft[K]) {
    setD((prev) => {
      const next = { ...prev, [k]: v };
      if (k === "title" && !slugTouched) next.slug = slugify(String(v));
      return next;
    });
  }

  async function upload(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const body = new FormData();
      body.set("file", file);
      const res = await fetch("/api/admin/uploads", { method: "POST", body });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Upload failed.");
      set("image", json.url);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving || deleting) return;
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
    const close = submitter?.dataset.close === "1";
    const sent = current;
    setSaving(true);
    setError(null);
    try {
      const url = savedSlug === null ? "/api/admin/articles" : `/api/admin/articles/${encodeURIComponent(savedSlug)}`;
      const res = await fetch(url, {
        method: savedSlug === null ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: sent,
      });
      const json = (await res.json().catch(() => ({}))) as { article?: Article; error?: string };
      if (!res.ok || !json.article) throw new Error(json.error ?? "Failed to save.");
      const saved = toDraft(json.article);
      const savedText = serialize(saved);
      const wasNew = savedSlug === null;
      const renamed = !wasNew && savedSlug !== saved.slug;
      // Keep anything typed while the request was out; otherwise show what the server stored.
      setD((prev) => (serialize(prev) === sent ? saved : prev));
      setBaseline(savedText);
      setSavedSlug(saved.slug);
      setSlugTouched(true);
      setOffer(null);
      removeStored(storageKey);
      removeStored(`${DRAFT_PREFIX}${saved.slug}`);
      toast({
        tone: "success",
        text: wasNew ? (saved.published ? `Published “${saved.title}”.` : `Saved “${saved.title}” as a hidden draft.`) : "Changes saved.",
      });
      if (close) {
        router.push("/admin/articles");
        router.refresh();
      } else if (wasNew || renamed) {
        router.replace(`/admin/articles/${saved.slug}/edit`);
      } else {
        router.refresh();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      setError(message);
      toast({ tone: "error", text: `Not saved: ${message}` });
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (savedSlug === null || deleting) return;
    if (!window.confirm(`Delete “${d.title || savedSlug}”? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/articles/${encodeURIComponent(savedSlug)}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      removeStored(storageKey);
      setBaseline(current);
      toast({ tone: "success", text: "Article deleted." });
      router.push("/admin/articles");
      router.refresh();
    } catch {
      toast({ tone: "error", text: "Failed to delete the article." });
      setDeleting(false);
    }
  }

  function cancel() {
    if (dirty && !window.confirm("Leave without saving? The draft stays in this browser.")) return;
    router.push("/admin/articles");
  }

  function restore() {
    if (!offer) return;
    setD(offer.draft);
    if (offer.draft.slug !== slugify(offer.draft.title)) setSlugTouched(true);
    setOffer(null);
  }

  function discardOffer() {
    setOffer(null);
    if (!dirty) removeStored(storageKey);
  }

  async function findSimilar() {
    const text = [d.title, d.narration, d.summaryId, d.summaryEn, d.explanation.slice(0, 600)].filter(Boolean).join("\n").slice(0, 1500);
    if (text.trim().length < 8) {
      setSimilar({ status: "error", error: "Write a title or the claim first." });
      return;
    }
    setSimilar({ status: "loading" });
    try {
      const q = new URLSearchParams({ text, limit: "5" });
      if (savedSlug) q.set("exclude", savedSlug);
      const res = await fetch(`/api/admin/articles/similar?${q}`);
      const json = (await res.json().catch(() => ({}))) as { items?: ArticleListItem[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setSimilar({ status: "done", items: json.items ?? [] });
    } catch (err) {
      setSimilar({ status: "error", error: err instanceof Error ? err.message : "The search failed." });
    }
  }

  const isNew = savedSlug === null;
  const saveLabel = saving ? "Saving…" : isNew ? (d.published ? "Publish" : "Save draft") : "Save changes";

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(340px,400px)]">
      <form ref={formRef} onSubmit={onSubmit} className="min-w-0 space-y-4">
        {offer && (
          <div role="status" className="neu flex flex-wrap items-center gap-3 border border-brand/30 bg-brand/5 p-4 text-sm">
            <span className="min-w-0 flex-1">
              <span className="font-medium">An unsaved draft of this article is kept in this browser.</span>
              <span className="block text-xs text-ink-muted">{offer.draft.title ? `“${offer.draft.title}”, ` : ""}last edited {stampLabel(offer.at)}.</span>
            </span>
            <button type="button" onClick={restore} className="btn-primary px-4 py-2 text-xs">
              Restore draft from {stampLabel(offer.at)}
            </button>
            <button type="button" onClick={discardOffer} className="neu-btn px-4 py-2 text-xs">
              Discard
            </button>
          </div>
        )}

        <div className="neu flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" checked={d.published} onChange={(e) => set("published", e.target.checked)} className="h-4 w-4 accent-brand" />
            <span>
              <span className="font-medium">Visible on the site</span>
              <span className="block text-xs text-ink-faint">Untick to keep it as a hidden draft.</span>
            </span>
          </label>
          {initial?.sourceSite && (
            <span className="text-xs text-ink-faint">
              Imported from <span className="font-medium text-ink-muted">{initial.sourceSite}</span>
            </span>
          )}
        </div>

        <div className="neu space-y-4 p-6">
          <div>
            <label htmlFor="article-title" className={labelCls}>
              Title *
            </label>
            <input id="article-title" required value={d.title} onChange={(e) => set("title", e.target.value)} className={field} placeholder="Fact-check article title" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className={labelCls}>Slug (URL)</span>
              <input
                value={d.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  set("slug", slugify(e.target.value));
                }}
                className={clsx(field, "font-mono text-xs")}
                placeholder="auto-from-title"
              />
              <span className="mt-1 block text-xs text-ink-faint">/blog/{d.slug || "…"}</span>
            </label>
            <label className="block">
              <span className={labelCls}>Date</span>
              <input type="date" value={d.date} onChange={(e) => set("date", e.target.value)} className={field} />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block">
              <span className={labelCls}>Language</span>
              <select value={d.lang} onChange={(e) => set("lang", e.target.value)} className={field}>
                <option value="id">Indonesian</option>
                <option value="en">English</option>
              </select>
            </label>
            <label className="block">
              <span className={labelCls}>Verdict</span>
              <select value={d.verdict} onChange={(e) => set("verdict", e.target.value)} className={field}>
                <option value="hoax">Hoax</option>
                <option value="misleading">Misleading</option>
                <option value="valid">Credible</option>
              </select>
            </label>
            <label className="block">
              <span className={labelCls}>Category</span>
              <input value={d.category} onChange={(e) => set("category", e.target.value)} className={field} placeholder="Misinformation" />
            </label>
          </div>

          <div>
            <span className={labelCls}>Cover image</span>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                list="img-opts"
                value={d.image}
                onChange={(e) => set("image", e.target.value)}
                placeholder="Empty = a plain cover in the verdict's colour"
                aria-label="Cover image URL"
                className={clsx(field, "font-mono text-xs")}
              />
              <label className={clsx("neu-btn shrink-0 cursor-pointer px-4 py-2.5 text-center text-sm", uploading && "pointer-events-none opacity-50")}>
                {uploading ? "Uploading…" : "Upload image"}
                <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" onChange={(e) => void upload(e.target.files?.[0])} />
              </label>
            </div>
            <datalist id="img-opts">
              {IMAGE_OPTIONS.map((o) => (
                <option key={o} value={o} />
              ))}
            </datalist>
            {uploadError && <p className="mt-1 text-xs text-verdict-hoax">{uploadError}</p>}
          </div>
        </div>

        <div className="neu space-y-4 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 flex items-baseline justify-between gap-2 text-xs font-medium text-ink-muted">
                <span>Summary (Indonesian)</span>
                <Counter value={d.summaryId} limit={SUMMARY_LIMIT} />
              </span>
              <textarea rows={3} value={d.summaryId} onChange={(e) => set("summaryId", e.target.value)} className={clsx(field, "resize-y")} />
            </label>
            <label className="block">
              <span className="mb-1.5 flex items-baseline justify-between gap-2 text-xs font-medium text-ink-muted">
                <span>Summary (English)</span>
                <Counter value={d.summaryEn} limit={SUMMARY_LIMIT} />
              </span>
              <textarea rows={3} value={d.summaryEn} onChange={(e) => set("summaryEn", e.target.value)} className={clsx(field, "resize-y")} />
            </label>
          </div>
          <label className="block">
            <span className={labelCls}>Narration (original claim)</span>
            <input value={d.narration} onChange={(e) => set("narration", e.target.value)} className={field} />
          </label>

          <SimilarPanel similar={similar} onFind={findSimilar} />

          <label className="block">
            <span className={labelCls}>Source</span>
            <textarea rows={2} value={d.source} onChange={(e) => set("source", e.target.value)} className={clsx(field, "resize-y")} />
          </label>
          <label className="block">
            <span className={labelCls}>Explanation</span>
            <textarea rows={6} value={d.explanation} onChange={(e) => set("explanation", e.target.value)} className={clsx(field, "resize-y")} />
          </label>
          <label className="block">
            <span className={labelCls}>Reference</span>
            <textarea rows={2} value={d.reference} onChange={(e) => set("reference", e.target.value)} className={clsx(field, "resize-y")} />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className={labelCls}>Original source link (optional)</span>
              <input value={d.originalUrl} onChange={(e) => set("originalUrl", e.target.value)} className={clsx(field, "font-mono text-xs")} placeholder="https://…" />
            </label>
            <label className="block">
              <span className={labelCls}>Fact-check publisher site (optional)</span>
              <input value={d.sourceSite} onChange={(e) => set("sourceSite", e.target.value)} className={clsx(field, "font-mono text-xs")} placeholder="turnbackhoax.id" />
            </label>
          </div>
        </div>

        {error && <p className="rounded-lg border border-verdict-hoax/30 bg-verdict-hoax/10 px-4 py-2.5 text-sm text-verdict-hoax">{error}</p>}

        {/* The action bar stays in view at the bottom of the screen while the form scrolls. */}
        <div className="sticky bottom-3 z-20 flex flex-wrap items-center gap-2 rounded-2xl border border-hairline bg-surface-raised/90 px-4 py-3 shadow-neu-lg backdrop-blur">
          <button type="submit" disabled={saving || deleting} className="btn-primary px-5 py-2.5 text-sm disabled:opacity-50">
            {saveLabel}
          </button>
          <button type="submit" data-close="1" disabled={saving || deleting} className="neu-btn px-4 py-2.5 text-sm disabled:opacity-50">
            Save and close
          </button>
          <button type="button" onClick={cancel} className="px-3 py-2.5 text-sm text-ink-muted hover:text-ink">
            Cancel
          </button>
          <span className="ml-auto flex flex-wrap items-center gap-2">
            {dirty ? (
              <span role="status" className="inline-flex items-center gap-1.5 rounded-full bg-verdict-warn/10 px-2.5 py-1 text-xs font-medium text-verdict-warn" title="A copy is kept in this browser until you save">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-verdict-warn" />
                Unsaved changes
              </span>
            ) : (
              !isNew && (
                <span role="status" className="inline-flex items-center gap-1.5 rounded-full bg-verdict-valid/10 px-2.5 py-1 text-xs font-medium text-verdict-valid">
                  <span aria-hidden>✓</span> Saved
                </span>
              )
            )}
            <kbd className="hidden rounded border border-hairline px-1.5 font-mono text-[10px] text-ink-faint sm:inline" title="Save with Ctrl+S or ⌘S">
              Ctrl S
            </kbd>
            {!isNew && (
              <button type="button" onClick={remove} disabled={deleting || saving} className={clsx(pill, "text-verdict-hoax hover:border-verdict-hoax/40 hover:bg-verdict-hoax/10")}>
                {deleting ? "Deleting…" : "Delete"}
              </button>
            )}
          </span>
        </div>
      </form>

      <aside className="min-w-0 xl:sticky xl:top-20 xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto" aria-label="Live preview">
        <ArticlePreview d={d} />
      </aside>
    </div>
  );
}

function Counter({ value, limit }: { value: string; limit: number }) {
  const n = value.trim().length;
  return (
    <span className={clsx("font-mono text-[11px] tabular-nums", n > limit ? "font-semibold text-verdict-warn" : "text-ink-faint")} title={n > limit ? `Over the ${limit}-character guide` : undefined}>
      {n.toLocaleString("en-US")} / {limit}
    </span>
  );
}

function SimilarPanel({ similar, onFind }: { similar: Similar; onFind: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-hairline p-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={onFind} disabled={similar.status === "loading"} className={pill}>
          {similar.status === "loading" ? "Searching…" : "Find similar in archive"}
        </button>
        <span className="text-xs text-ink-faint">Checks the title, claim and summaries against published fact-checks, to catch duplicates.</span>
      </div>
      {similar.status === "error" && <p className="mt-2 text-xs text-verdict-hoax">{similar.error}</p>}
      {similar.status === "done" && similar.items.length === 0 && <p className="mt-2 text-xs text-verdict-valid">No similar published article found.</p>}
      {similar.status === "done" && similar.items.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium text-verdict-warn">
            {similar.items.length === 1 ? "1 published article looks like the same claim." : `${similar.items.length} published articles look like the same claim.`} Check before saving.
          </p>
          <ul className="mt-2 divide-y divide-hairline">
            {similar.items.map((a) => (
              <li key={a.slug} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: VERDICT_META[a.verdict].color }} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 font-medium">{a.title}</span>
                  <span className="block text-xs text-ink-faint">
                    {VERDICT_META[a.verdict].labelEn}
                    {a.date ? ` · ${formatDate(a.date)}` : ""}
                    {a.sourceSite ? ` · ${sourceName(a.sourceSite)}` : ""}
                  </span>
                </span>
                <Link href={`/admin/articles/${a.slug}/edit`} target="_blank" className="text-xs text-brand hover:underline">
                  Edit ↗
                </Link>
                <Link href={`/blog/${a.slug}`} target="_blank" className="text-xs text-ink-muted hover:text-ink">
                  View ↗
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------------- live preview */

function ArticlePreview({ d }: { d: Draft }) {
  const verdict: Article["verdict"] = d.verdict === "hoax" || d.verdict === "valid" ? d.verdict : "misleading";
  const lang: Article["lang"] = d.lang === "en" ? "en" : "id";
  const meta = VERDICT_META[verdict];
  const title = d.title.trim() || "Untitled article";
  const summary = d.summaryEn.trim() || d.summaryId.trim();
  const date = formatDate(d.date);
  const site = d.sourceSite.trim();
  const preSection = (label: string, text: string, tone?: string, italic?: boolean) =>
    text.trim() ? (
      <section className="neu-inset rounded-xl p-4" style={tone ? { borderLeft: `3px solid ${tone}` } : undefined}>
        <h4 className="eyebrow text-[10px]">{label}</h4>
        <p className={clsx("mt-2 whitespace-pre-line break-words text-sm leading-relaxed", italic ? "italic text-ink-muted" : "text-ink")}>{text.trim()}</p>
      </section>
    ) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-muted">Live preview</h2>
        {!d.published && <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-faint">hidden draft</span>}
      </div>

      {/* The card as the archive and the home page show it. */}
      <div className="neu flex flex-col overflow-hidden">
        <div className="relative aspect-[16/9] overflow-hidden">
          {d.image ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={d.image} alt="" className="h-full w-full object-cover" />
          ) : (
            <CoverPlaceholder verdict={verdict} label={site ? sourceName(site) : undefined} />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/30 to-transparent" />
          <div className="absolute left-3 top-3">
            <VerdictBadge verdict={verdict} />
          </div>
          <span className="absolute right-3 top-3 rounded-md bg-black/40 px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-white/80 backdrop-blur">
            {LANGUAGE_NAME[lang]}
          </span>
        </div>
        <div className="flex flex-1 flex-col p-5">
          <h3 className={clsx("font-display text-base font-bold leading-snug text-balance", !d.title.trim() && "text-ink-faint")}>{title}</h3>
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-muted">{summary || <span className="text-ink-faint">No summary yet.</span>}</p>
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-hairline pt-4 text-xs text-ink-faint">
            <span className="truncate">{site ? sourceName(site) : d.category}</span>
            {date && <span className="shrink-0">{date}</span>}
          </div>
        </div>
      </div>

      {/* The top of the article page. */}
      <div className="neu space-y-3 p-5">
        <div className="flex flex-wrap items-center gap-1.5">
          <VerdictBadge verdict={verdict} />
          {d.category && d.category !== meta.labelEn && <span className="rounded-md bg-surface-sunken px-2 py-0.5 text-[11px] font-medium text-ink-muted">{d.category}</span>}
          {formatDate(d.date, "long") && <span className="text-[11px] text-ink-faint">{formatDate(d.date, "long")}</span>}
        </div>
        <h3 className={clsx("font-display text-xl font-bold leading-tight text-balance", !d.title.trim() && "text-ink-faint")}>{title}</h3>
        {site && (
          <p className="text-xs text-ink-muted">
            Fact-check by <span className="font-medium text-ink">{sourceName(site)}</span>
          </p>
        )}
        {summary && (
          <p className="border-l-4 pl-3 text-sm leading-relaxed text-ink" style={{ borderColor: meta.color }}>
            {summary}
          </p>
        )}
        {preSection("The claim", d.narration, meta.color, true)}
        {preSection("What the fact-check found", d.explanation)}
        {preSection("Where it circulated", d.source)}
        {preSection("References", d.reference)}
        {!d.narration.trim() && !d.explanation.trim() && <p className="text-xs text-ink-faint">Without a claim or an explanation the page shows only the title and a link to the original.</p>}
        <p className="border-t border-hairline pt-3 font-mono text-[11px] text-ink-faint">/blog/{d.slug || "…"}</p>
      </div>
    </div>
  );
}
