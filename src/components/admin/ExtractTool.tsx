"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { VerdictBadge } from "@/components/article/ArticleCard";
import { clsx } from "@/lib/clsx";
import type { ExtractResult, ExtractedFields } from "@/lib/extract";
import { slugify } from "@/lib/slug";
import { formatDate, sourceName } from "@/lib/sources";

const field = "w-full rounded-lg border border-hairline bg-surface-sunken px-3.5 py-2.5 text-sm text-ink outline-none focus:ring-2 focus:ring-brand/30";
const labelCls = "mb-1.5 block text-xs font-medium text-ink-muted";

const DATE_FROM: Record<ExtractedFields["dateFrom"], string> = {
  url: "from the address",
  meta: "from the page's metadata",
  text: "found in the text",
  today: "not found; today",
};

/** "slug" → "slug-2", "slug-2" → "slug-3". */
function nextSlug(slug: string): string {
  const m = slug.match(/^(.*)-(\d+)$/);
  return m ? `${m[1]}-${Number(m[2]) + 1}` : `${slug}-2`;
}

export function ExtractTool({ initialText = "" }: { initialText?: string }) {
  const router = useRouter();
  const [input, setInput] = useState(initialText);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExtractResult | null>(null);
  const [d, setD] = useState<ExtractedFields | null>(null);
  const [saving, setSaving] = useState<"draft" | "publish" | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function process(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    setBusy(true);
    setError(null);
    setSaveError(null);
    try {
      const res = await fetch("/api/admin/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Extraction failed.");
      const r = json as ExtractResult;
      setResult(r);
      setD(r.fields);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Extraction failed.");
    } finally {
      setBusy(false);
    }
  }

  function set<K extends keyof ExtractedFields>(k: K, v: ExtractedFields[K]) {
    setD((prev) => (prev ? { ...prev, [k]: v } : prev));
  }

  async function save(published: boolean) {
    if (!d) return;
    setSaving(published ? "publish" : "draft");
    setSaveError(null);
    try {
      const body = {
        slug: d.slug,
        title: d.title,
        lang: d.lang,
        category: d.category,
        verdict: d.verdict,
        date: d.date,
        summaryId: d.lang === "id" ? d.summary : "",
        summaryEn: d.lang === "en" ? d.summary : "",
        source: d.source,
        narration: d.narration,
        explanation: d.explanation,
        reference: d.reference,
        image: "",
        originalUrl: d.originalUrl,
        sourceSite: d.sourceSite,
        published,
      };
      const res = await fetch("/api/admin/articles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      if (res.status === 409) {
        const suggestion = nextSlug(d.slug || slugify(d.title));
        set("slug", suggestion);
        throw new Error(`${json.error} The slug was changed to "${suggestion}"; save again to use it.`);
      }
      if (!res.ok) throw new Error(json.error ?? "Failed to save.");
      const slug: string = json.article?.slug ?? d.slug;
      router.push(`/admin/articles/${slug}/edit`);
      router.refresh();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save.");
      setSaving(null);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={process} className="neu space-y-4 p-6">
        <label className="block">
          <span className={labelCls}>Link, HTML or text</span>
          <textarea
            rows={6}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="https://turnbackhoax.id/2019/04/06/salah-…  or paste the page's HTML, or the forwarded message itself"
            className={clsx(field, "resize-y font-mono text-xs leading-relaxed")}
          />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={busy || !input.trim()} className="btn-primary px-6 py-3 text-sm disabled:opacity-50">
            {busy ? "Reading…" : "Process"}
          </button>
          <span className="text-xs text-ink-faint">Links on the skip list (Settings → Skipped domains) are refused.</span>
        </div>
      </form>

      {error && <p className="rounded-lg border border-verdict-hoax/30 bg-verdict-hoax/10 px-4 py-2.5 text-sm text-verdict-hoax">{error}</p>}

      {result && d && (
        <>
          {(result.notes.length > 0 || result.source) && (
            <div className="neu space-y-2 p-5 text-sm">
              {result.source && (
                <p className="text-ink-muted">
                  Read from{" "}
                  <a href={result.source.url} target="_blank" rel="noopener noreferrer nofollow" className="font-medium text-ink hover:text-brand">
                    {result.source.title} ↗
                  </a>
                </p>
              )}
              {result.notes.length > 0 && (
                <ul className="space-y-1 rounded-lg border border-verdict-warn/30 bg-verdict-warn/10 px-4 py-3 text-xs leading-relaxed text-ink-muted">
                  {result.notes.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {result.similar.length > 0 && (
            <div className="neu p-5">
              <h2 className="eyebrow">Already in the archive</h2>
              <p className="mt-1 text-xs text-ink-faint">Fact-checks that share this claim&apos;s key words. Check them before saving a duplicate.</p>
              <ul className="mt-3 space-y-2">
                {result.similar.map((a) => (
                  <li key={a.slug} className="flex items-start gap-3 rounded-lg border border-hairline p-3">
                    <VerdictBadge verdict={a.verdict} className="mt-0.5 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <Link href={`/admin/articles/${a.slug}/edit`} className="block text-sm font-medium leading-snug hover:text-brand">
                        {a.title}
                      </Link>
                      <span className="mt-0.5 block text-xs text-ink-faint">
                        {[a.sourceSite && sourceName(a.sourceSite), formatDate(a.date), !a.published && "hidden"].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <Link href={`/blog/${a.slug}`} target="_blank" className="text-ink-faint hover:text-ink" title="Open on the site">
                      ↗
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="neu space-y-4 p-6">
            <label className="block">
              <span className={labelCls}>Title *</span>
              <input required value={d.title} onChange={(e) => set("title", e.target.value)} className={field} />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className={labelCls}>Slug (URL)</span>
                <input value={d.slug} onChange={(e) => set("slug", slugify(e.target.value))} className={clsx(field, "font-mono text-xs")} />
                <span className="mt-1 block text-xs text-ink-faint">/blog/{d.slug || "…"}</span>
              </label>
              <label className="block">
                <span className={labelCls}>Date</span>
                <input type="date" value={d.date} onChange={(e) => set("date", e.target.value)} className={field} />
                <span className="mt-1 block text-xs text-ink-faint">{DATE_FROM[d.dateFrom]}</span>
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block">
                <span className={labelCls}>Verdict</span>
                <select value={d.verdict} onChange={(e) => set("verdict", e.target.value as ExtractedFields["verdict"])} className={field}>
                  <option value="hoax">Hoax</option>
                  <option value="misleading">Misleading</option>
                  <option value="valid">Credible</option>
                </select>
                <span className={clsx("mt-1 block text-xs", d.verdictGuessed ? "text-verdict-warn" : "text-ink-faint")}>
                  {d.verdictGuessed ? "guessed; no label in the title" : d.verdictTag === "headline" ? "from the headline's wording" : `from the title tag [${d.verdictTag}]`}
                </span>
              </label>
              <label className="block">
                <span className={labelCls}>Category</span>
                <input value={d.category} onChange={(e) => set("category", e.target.value)} className={field} />
              </label>
              <label className="block">
                <span className={labelCls}>Language</span>
                <select value={d.lang} onChange={(e) => set("lang", e.target.value as ExtractedFields["lang"])} className={field}>
                  <option value="id">Indonesian</option>
                  <option value="en">English</option>
                </select>
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className={labelCls}>Source site</span>
                <input value={d.sourceSite} onChange={(e) => set("sourceSite", e.target.value)} className={clsx(field, "font-mono text-xs")} placeholder="turnbackhoax.id" />
              </label>
              <label className="block">
                <span className={labelCls}>Original link</span>
                <input value={d.originalUrl} onChange={(e) => set("originalUrl", e.target.value)} className={clsx(field, "font-mono text-xs")} placeholder="https://…" />
              </label>
            </div>
          </div>

          <div className="neu space-y-4 p-6">
            <label className="block">
              <span className={labelCls}>Summary ({d.lang === "en" ? "English" : "Indonesian"})</span>
              <textarea rows={2} value={d.summary} onChange={(e) => set("summary", e.target.value)} className={clsx(field, "resize-none")} />
            </label>
            <label className="block">
              <span className={labelCls}>Narration (the claim as it circulated)</span>
              <textarea rows={5} value={d.narration} onChange={(e) => set("narration", e.target.value)} className={clsx(field, "resize-y")} />
            </label>
            <label className="block">
              <span className={labelCls}>Explanation (what the fact-checkers found)</span>
              <textarea rows={10} value={d.explanation} onChange={(e) => set("explanation", e.target.value)} className={clsx(field, "resize-y")} />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className={labelCls}>Source (where the claim was seen)</span>
                <textarea rows={3} value={d.source} onChange={(e) => set("source", e.target.value)} className={clsx(field, "resize-y")} />
              </label>
              <label className="block">
                <span className={labelCls}>References (one per line)</span>
                <textarea rows={3} value={d.reference} onChange={(e) => set("reference", e.target.value)} className={clsx(field, "resize-y font-mono text-xs")} />
              </label>
            </div>
          </div>

          {saveError && <p className="rounded-lg border border-verdict-hoax/30 bg-verdict-hoax/10 px-4 py-2.5 text-sm text-verdict-hoax">{saveError}</p>}

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => void save(false)} disabled={saving !== null || !d.title.trim()} className="neu-btn px-5 py-3 text-sm disabled:opacity-50">
              {saving === "draft" ? "Saving…" : "Save as hidden draft"}
            </button>
            <button type="button" onClick={() => void save(true)} disabled={saving !== null || !d.title.trim()} className="btn-primary px-6 py-3 text-sm disabled:opacity-50">
              {saving === "publish" ? "Saving…" : "Save and publish"}
            </button>
            <span className="text-xs text-ink-faint">Both open the saved article in the editor.</span>
          </div>
        </>
      )}
    </div>
  );
}
