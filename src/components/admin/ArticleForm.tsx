"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Article } from "@/lib/data";
import { slugify } from "@/lib/slug";
import { clsx } from "@/lib/clsx";

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

type Draft = Omit<Article, "lang" | "verdict" | "published"> & { lang: string; verdict: string; published: boolean };

const EMPTY: Draft = {
  slug: "", title: "", lang: "id", category: "Misinformation", verdict: "misleading",
  date: new Date().toISOString().slice(0, 10),
  summaryId: "", summaryEn: "", source: "", narration: "", explanation: "", reference: "",
  image: "", originalUrl: "", published: true,
};

export function ArticleForm({ initial, mode }: { initial?: Article; mode: "new" | "edit" }) {
  const router = useRouter();
  const [d, setD] = useState<Draft>(
    initial ? { ...initial, originalUrl: initial.originalUrl ?? "", published: initial.published !== false } : EMPTY,
  );
  const [slugTouched, setSlugTouched] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

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

  function set<K extends keyof Draft>(k: K, v: Draft[K]) {
    setD((prev) => {
      const next = { ...prev, [k]: v };
      if (k === "title" && !slugTouched) next.slug = slugify(String(v));
      return next;
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const url = mode === "new" ? "/api/admin/articles" : `/api/admin/articles/${initial!.slug}`;
      const res = await fetch(url, {
        method: mode === "new" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(d),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to save.");
      router.push("/admin/articles");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
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
        <label className="block">
          <span className={labelCls}>Title *</span>
          <input required value={d.title} onChange={(e) => set("title", e.target.value)} className={field} placeholder="Fact-check article title" />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={labelCls}>Slug (URL)</span>
            <input
              value={d.slug}
              onChange={(e) => { setSlugTouched(true); set("slug", slugify(e.target.value)); }}
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
            {IMAGE_OPTIONS.map((o) => <option key={o} value={o} />)}
          </datalist>
          {uploadError && <p className="mt-1 text-xs text-verdict-hoax">{uploadError}</p>}
          {d.image && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={d.image} alt="" className="mt-2 aspect-[16/9] w-full max-w-xs rounded-lg border border-hairline object-cover" />
          )}
        </div>
      </div>

      <div className="neu space-y-4 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={labelCls}>Summary (Indonesian)</span>
            <textarea rows={3} value={d.summaryId} onChange={(e) => set("summaryId", e.target.value)} className={clsx(field, "resize-none")} />
          </label>
          <label className="block">
            <span className={labelCls}>Summary (English)</span>
            <textarea rows={3} value={d.summaryEn} onChange={(e) => set("summaryEn", e.target.value)} className={clsx(field, "resize-none")} />
          </label>
        </div>
        <label className="block">
          <span className={labelCls}>Narration (original claim)</span>
          <input value={d.narration} onChange={(e) => set("narration", e.target.value)} className={field} />
        </label>
        <label className="block">
          <span className={labelCls}>Source</span>
          <textarea rows={2} value={d.source} onChange={(e) => set("source", e.target.value)} className={clsx(field, "resize-none")} />
        </label>
        <label className="block">
          <span className={labelCls}>Explanation</span>
          <textarea rows={5} value={d.explanation} onChange={(e) => set("explanation", e.target.value)} className={clsx(field, "resize-none")} />
        </label>
        <label className="block">
          <span className={labelCls}>Reference</span>
          <textarea rows={2} value={d.reference} onChange={(e) => set("reference", e.target.value)} className={clsx(field, "resize-none")} />
        </label>
        <label className="block">
          <span className={labelCls}>Original source link (optional)</span>
          <input value={d.originalUrl} onChange={(e) => set("originalUrl", e.target.value)} className={clsx(field, "font-mono text-xs")} placeholder="https://…" />
        </label>
      </div>

      {error && (
        <p className="rounded-lg border border-verdict-hoax/30 bg-verdict-hoax/10 px-4 py-2.5 text-sm text-verdict-hoax">{error}</p>
      )}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving} className="btn-primary px-6 py-3 text-sm">
          {saving ? "Saving…" : mode === "new" ? "Publish" : "Save changes"}
        </button>
        <button type="button" onClick={() => router.push("/admin/articles")} className="neu-btn px-5 py-3 text-sm">
          Cancel
        </button>
      </div>
    </form>
  );
}
