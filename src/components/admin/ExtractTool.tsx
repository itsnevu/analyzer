"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { VerdictBadge } from "@/components/article/ArticleCard";
import { adminLocale, tk, type AdminLang } from "@/lib/admin-lang";
import { clsx } from "@/lib/clsx";
import type { ExtractResult, ExtractedFields } from "@/lib/extract";
import { slugify } from "@/lib/slug";
import { sourceName } from "@/lib/sources";
import { useAdminT } from "./AdminLang";

const field = "w-full rounded-lg border border-hairline bg-surface-sunken px-3.5 py-2.5 text-sm text-ink outline-none focus:ring-2 focus:ring-brand/30";
const labelCls = "mb-1.5 block text-sm font-medium text-ink-muted";

const DATE_FROM: Record<ExtractedFields["dateFrom"], string> = {
  url: tk("Taken from the link"),
  meta: tk("Taken from the page details"),
  text: tk("Found in the text"),
  today: tk("Not found, so today's date is used"),
};

/** "slug" → "slug-2", "slug-2" → "slug-3". */
function nextSlug(slug: string): string {
  const m = slug.match(/^(.*)-(\d+)$/);
  return m ? `${m[1]}-${Number(m[2]) + 1}` : `${slug}-2`;
}

/** "2019-04-06" → "Apr 6, 2019" / "6 Apr 2019"; "" or junk → "". */
function dayLabel(date: string, lang: AdminLang): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "";
  const d = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(adminLocale(lang), { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export function ExtractTool({ initialText = "" }: { initialText?: string }) {
  const router = useRouter();
  const { t, lang } = useAdminT();
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
      if (!res.ok) throw new Error(json.error ?? t("Could not read this."));
      const r = json as ExtractResult;
      setResult(r);
      setD(r.fields);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Could not read this."));
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
        throw new Error(t("{error} The web address was changed to “{slug}”; press save again to use it.", { error: json.error ?? "", slug: suggestion }));
      }
      if (!res.ok) throw new Error(json.error ?? t("Could not save."));
      const slug: string = json.article?.slug ?? d.slug;
      router.push(`/admin/articles/${slug}/edit`);
      router.refresh();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : t("Could not save."));
      setSaving(null);
    }
  }

  const verdictNote = !d
    ? ""
    : d.verdictGuessed
      ? t("Guessed: the title has no verdict label")
      : d.verdictTag === "headline"
        ? t("Taken from the wording of the headline")
        : t("Taken from the label in the title [{tag}]", { tag: d.verdictTag });

  return (
    <div className="space-y-4">
      <form onSubmit={process} className="neu space-y-4 p-6">
        <label className="block">
          <span className={labelCls}>{t("Link, page code or text")}</span>
          <textarea
            rows={6}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t("https://turnbackhoax.id/2019/04/06/salah-…  or paste the page code, or the forwarded message itself")}
            className={clsx(field, "resize-y font-mono text-xs leading-relaxed")}
          />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={busy || !input.trim()} className="btn-primary px-6 py-3 text-sm disabled:opacity-50">
            {busy ? t("Reading…") : t("Fill in the form")}
          </button>
          <span className="text-xs text-ink-faint">{t("Links from websites on the skip list (Settings → Skipped domains) are refused.")}</span>
        </div>
      </form>

      {error && <p className="rounded-lg border border-verdict-hoax/30 bg-verdict-hoax/10 px-4 py-2.5 text-sm text-verdict-hoax">{error}</p>}

      {result && d && (
        <>
          {(result.notes.length > 0 || result.source) && (
            <div className="neu space-y-2 p-5 text-sm">
              {result.source && (
                <p className="text-ink-muted">
                  {t("Read from")}{" "}
                  <a href={result.source.url} target="_blank" rel="noopener noreferrer nofollow" className="font-medium text-ink hover:text-brand">
                    {result.source.title} ↗
                  </a>
                </p>
              )}
              {result.notes.length > 0 && (
                <ul className="space-y-1 rounded-lg border border-verdict-warn/30 bg-verdict-warn/10 px-4 py-3 text-sm leading-relaxed text-ink-muted">
                  {result.notes.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {result.similar.length > 0 && (
            <div className="neu p-5">
              <h2 className="eyebrow">{t("Already in the archive")}</h2>
              <p className="mt-1 text-sm text-ink-faint">{t("Fact-checks that use the same key words. Check them so you do not save the same thing twice.")}</p>
              <ul className="mt-3 space-y-2">
                {result.similar.map((a) => (
                  <li key={a.slug} className="flex items-start gap-3 rounded-lg border border-hairline p-3">
                    <VerdictBadge verdict={a.verdict} className="mt-0.5 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <Link href={`/admin/articles/${a.slug}/edit`} className="block text-sm font-medium leading-snug hover:text-brand">
                        {a.title}
                      </Link>
                      <span className="mt-0.5 block text-xs text-ink-faint">
                        {[a.sourceSite && sourceName(a.sourceSite), dayLabel(a.date, lang), !a.published && t("Hidden")].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <Link href={`/blog/${a.slug}`} target="_blank" className="px-1 text-ink-faint hover:text-ink" title={t("View on site")} aria-label={t("View on site")}>
                      ↗
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="neu space-y-4 p-6">
            <label className="block">
              <span className={labelCls}>{t("Title *")}</span>
              <input required value={d.title} onChange={(e) => set("title", e.target.value)} className={field} />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className={labelCls}>{t("Web address (slug)")}</span>
                <input value={d.slug} onChange={(e) => set("slug", slugify(e.target.value))} className={clsx(field, "font-mono text-xs")} />
                <span className="mt-1 block text-xs text-ink-faint">/blog/{d.slug || "…"}</span>
              </label>
              <label className="block">
                <span className={labelCls}>{t("Date")}</span>
                <input type="date" value={d.date} onChange={(e) => set("date", e.target.value)} className={field} />
                <span className="mt-1 block text-xs text-ink-faint">{t(DATE_FROM[d.dateFrom])}</span>
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block">
                <span className={labelCls}>{t("Verdict")}</span>
                <select value={d.verdict} onChange={(e) => set("verdict", e.target.value as ExtractedFields["verdict"])} className={field}>
                  <option value="hoax">{t("Hoax")}</option>
                  <option value="misleading">{t("Misleading")}</option>
                  <option value="valid">{t("Credible")}</option>
                </select>
                <span className={clsx("mt-1 block text-xs", d.verdictGuessed ? "text-verdict-warn" : "text-ink-faint")}>{verdictNote}</span>
              </label>
              <label className="block">
                <span className={labelCls}>{t("Category")}</span>
                <input value={d.category} onChange={(e) => set("category", e.target.value)} className={field} />
              </label>
              <label className="block">
                <span className={labelCls}>{t("Language")}</span>
                <select value={d.lang} onChange={(e) => set("lang", e.target.value as ExtractedFields["lang"])} className={field}>
                  <option value="id">{t("Indonesian")}</option>
                  <option value="en">{t("English")}</option>
                </select>
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className={labelCls}>{t("Website that published the fact-check")}</span>
                <input value={d.sourceSite} onChange={(e) => set("sourceSite", e.target.value)} className={clsx(field, "font-mono text-xs")} placeholder={"turnbackhoax.id"} />
              </label>
              <label className="block">
                <span className={labelCls}>{t("Link to the original fact-check")}</span>
                <input value={d.originalUrl} onChange={(e) => set("originalUrl", e.target.value)} className={clsx(field, "font-mono text-xs")} placeholder={"https://…"} />
              </label>
            </div>
          </div>

          <div className="neu space-y-4 p-6">
            <label className="block">
              <span className={labelCls}>{d.lang === "en" ? t("Short summary (English)") : t("Short summary (Indonesian)")}</span>
              <textarea rows={2} value={d.summary} onChange={(e) => set("summary", e.target.value)} className={clsx(field, "resize-none")} />
            </label>
            <label className="block">
              <span className={labelCls}>{t("The claim (as it was spread)")}</span>
              <textarea rows={5} value={d.narration} onChange={(e) => set("narration", e.target.value)} className={clsx(field, "resize-y")} />
            </label>
            <label className="block">
              <span className={labelCls}>{t("Explanation (what the fact-check found)")}</span>
              <textarea rows={10} value={d.explanation} onChange={(e) => set("explanation", e.target.value)} className={clsx(field, "resize-y")} />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className={labelCls}>{t("Where the claim was spread")}</span>
                <textarea rows={3} value={d.source} onChange={(e) => set("source", e.target.value)} className={clsx(field, "resize-y")} />
              </label>
              <label className="block">
                <span className={labelCls}>{t("References (one per line)")}</span>
                <textarea rows={3} value={d.reference} onChange={(e) => set("reference", e.target.value)} className={clsx(field, "resize-y font-mono text-xs")} />
              </label>
            </div>
          </div>

          {saveError && <p className="rounded-lg border border-verdict-hoax/30 bg-verdict-hoax/10 px-4 py-2.5 text-sm text-verdict-hoax">{saveError}</p>}

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => void save(false)} disabled={saving !== null || !d.title.trim()} className="neu-btn px-5 py-3 text-sm disabled:opacity-50">
              {saving === "draft" ? t("Saving…") : t("Save as hidden draft")}
            </button>
            <button type="button" onClick={() => void save(true)} disabled={saving !== null || !d.title.trim()} className="btn-primary px-6 py-3 text-sm disabled:opacity-50">
              {saving === "publish" ? t("Saving…") : t("Save and publish")}
            </button>
            <span className="text-sm text-ink-faint">{t("Both open the article in the editor afterwards.")}</span>
          </div>
        </>
      )}
    </div>
  );
}
