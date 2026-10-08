"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { VerdictBadge } from "@/components/article/ArticleCard";
import { clsx } from "@/lib/clsx";
import type { ArticleListItem } from "@/lib/data";
import type { Verdict } from "@/lib/detect";
import { REPORT_STATUSES, REPORT_TYPES, reportNumber, type Report, type ReportStatus, type ReportType } from "@/lib/report-labels";
import { sourceName } from "@/lib/sources";
import { adminLocale, formatAdminDateTime, type AdminLang } from "@/lib/admin-lang";
import { useAdminT } from "./AdminLang";

const STATUS_STYLE: Record<ReportStatus, string> = {
  new: "bg-verdict-hoax/10 text-verdict-hoax",
  "in-progress": "bg-verdict-warn/10 text-verdict-warn",
  done: "bg-verdict-valid/10 text-verdict-valid",
};

/** Longest text put in a `?text=` prefill link; the full text stays in the report. */
const PREFILL_MAX = 6000;
const prefill = (path: string, text: string) => `${path}?text=${encodeURIComponent(text.slice(0, PREFILL_MAX))}`;
const field = "w-full rounded-lg border border-hairline bg-surface-sunken px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-brand/30";

type Similar = ArticleListItem[] | "loading" | "error";
type Change = { status?: ReportStatus; read?: boolean; note?: string; resolvedSlug?: string };

/** The verdict a free-text "detector said" value names, if any (the form stores the label the visitor saw). */
function verdictOf(s: string): Verdict | null {
  const t = s.toLowerCase();
  if (/hoax|hoaks|palsu/.test(t)) return "hoax";
  if (/mislead|menyesatkan|misinfo|disinfo/.test(t)) return "misleading";
  if (/credible|valid|benar|true/.test(t)) return "valid";
  return null;
}

/** A slug typed as is, or taken from a /blog/<slug> or /admin/articles/<slug>/edit link. */
function slugFrom(input: string): string {
  const s = input.trim();
  const m = s.match(/\/(?:blog|admin\/articles)\/([^/?#]+)/);
  return (m ? m[1] : s).replace(/^\/+|\/+$/g, "");
}

/** "2019-04-06" → "Apr 6, 2019" / "6 Apr 2019"; "" or junk → "". */
function dayLabel(date: string, lang: AdminLang): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "";
  const d = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(adminLocale(lang), { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

/** A stored "YYYY-MM-DD HH:MM:SS" UTC stamp shown in Jakarta time. */
function stampLabel(stamp: string, lang: AdminLang): string {
  return `${formatAdminDateTime(`${stamp.replace(" ", "T")}Z`, lang)} WIB`;
}

export function ReportsList({ reports }: { reports: Report[] }) {
  const router = useRouter();
  const { t, lang } = useAdminT();
  const [open, setOpen] = useState<number | null>(null);
  const [items, setItems] = useState(reports);
  const [busy, setBusy] = useState<number | null>(null);
  const [similar, setSimilar] = useState<Record<number, Similar>>({});
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [noteState, setNoteState] = useState<Record<number, "saving" | "saved" | undefined>>({});
  const [slugInput, setSlugInput] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);

  async function patch(id: number, change: Change): Promise<boolean> {
    setError(null);
    setItems((list) =>
      list.map((r) =>
        r.id === id
          ? { ...r, ...(change.status ? { status: change.status } : {}), ...(change.read === undefined ? {} : { readAt: change.read ? r.readAt ?? "now" : null }) }
          : r,
      ),
    );
    try {
      const res = await fetch(`/api/admin/reports/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(change),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; report?: Report };
      if (!res.ok) throw new Error(json.error ?? t("The change was not saved."));
      if (json.report) setItems((list) => list.map((r) => (r.id === id ? { ...r, ...json.report } : r)));
      router.refresh();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : t("The change was not saved."));
      return false;
    }
  }

  async function loadSimilar(id: number) {
    if (similar[id]) return;
    setSimilar((s) => ({ ...s, [id]: "loading" }));
    try {
      const res = await fetch(`/api/admin/reports/${id}/similar`);
      if (!res.ok) throw new Error();
      const json = (await res.json()) as { similar: ArticleListItem[] };
      setSimilar((s) => ({ ...s, [id]: json.similar }));
    } catch {
      setSimilar((s) => ({ ...s, [id]: "error" }));
    }
  }

  function toggle(r: Report) {
    const next = open === r.id ? null : r.id;
    setOpen(next);
    if (!next) return;
    if (!r.readAt) void patch(r.id, { read: true });
    void loadSimilar(r.id);
    setNotes((n) => (r.id in n ? n : { ...n, [r.id]: r.note ?? "" }));
  }

  async function saveNote(r: Report) {
    setNoteState((s) => ({ ...s, [r.id]: "saving" }));
    const ok = await patch(r.id, { note: notes[r.id] ?? r.note ?? "" });
    setNoteState((s) => ({ ...s, [r.id]: ok ? "saved" : undefined }));
  }

  async function resolve(r: Report, input: string) {
    const slug = slugFrom(input);
    if (!slug) return;
    setBusy(r.id);
    if (await patch(r.id, { resolvedSlug: slug, status: "done" })) setSlugInput((s) => ({ ...s, [r.id]: "" }));
    setBusy(null);
  }

  async function remove(r: Report) {
    if (!confirm(t("Delete {number}? This cannot be undone.", { number: reportNumber(r.id) }))) return;
    setBusy(r.id);
    try {
      const res = await fetch(`/api/admin/reports/${r.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setItems((list) => list.filter((x) => x.id !== r.id));
      router.refresh();
    } catch {
      setError(t("Could not delete it."));
    } finally {
      setBusy(null);
    }
  }

  if (items.length === 0) {
    return <div className="neu p-10 text-center text-sm text-ink-muted">{t("Nothing here.")}</div>;
  }

  return (
    <div className="space-y-3">
      {error && <p className="rounded-lg border border-verdict-hoax/30 bg-verdict-hoax/10 px-4 py-2.5 text-sm text-verdict-hoax">{error}</p>}
      <ul className="space-y-3">
        {items.map((r) => {
          const isReport = r.kind === "report";
          const typeLabel = REPORT_TYPES[r.reportType as ReportType];
          const title = isReport ? (typeLabel ? t(typeLabel) : t("Report")) : r.subject || t("Message");
          const from = [r.firstName, r.lastName].filter(Boolean).join(" ") || t("Anonymous");
          const text = isReport ? r.content : r.message;
          const preview = text.replace(/\s+/g, " ");
          const expanded = open === r.id;
          const found = similar[r.id];
          const matches = Array.isArray(found) ? found : [];
          const statusLabel = REPORT_STATUSES[r.status];
          return (
            <li key={r.id} className={clsx("neu overflow-hidden p-0", !r.readAt && "ring-1 ring-verdict-hoax/30")}>
              <button onClick={() => toggle(r)} className="flex w-full items-start gap-3 p-5 text-left" aria-expanded={expanded}>
                <span
                  className={clsx("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", r.readAt ? "bg-transparent" : "bg-verdict-hoax")}
                  role={r.readAt ? undefined : "img"}
                  aria-label={r.readAt ? undefined : t("Unread")}
                  aria-hidden={r.readAt ? true : undefined}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-ink-faint">{reportNumber(r.id)}</span>
                    <span className="font-medium">{title}</span>
                    <span className={clsx("rounded-full px-2 py-0.5 text-xs font-semibold", STATUS_STYLE[r.status] ?? STATUS_STYLE.new)}>
                      {statusLabel ? t(statusLabel) : r.status}
                    </span>
                    {r.resolvedSlug && <span className="text-xs text-ink-faint">{t("answered by “{title}”", { title: r.resolvedTitle || r.resolvedSlug })}</span>}
                    {r.note && <span className="text-xs text-ink-faint">{t("has a note")}</span>}
                    {r.attachment && <span className="text-xs text-ink-faint">{t("has a screenshot")}</span>}
                  </span>
                  <span className="mt-1 block truncate text-sm text-ink-muted">{preview}</span>
                  <span className="mt-1 block text-xs text-ink-faint" suppressHydrationWarning>
                    {from}
                    {r.email && ` · ${r.email}`} · {stampLabel(r.createdAt, lang)}
                  </span>
                </span>
              </button>

              {expanded && (
                <div className="space-y-4 border-t border-hairline px-5 pb-5 pt-4 text-sm">
                  {isReport ? (
                    <>
                      <div>
                        <div className="eyebrow">{t("What they reported")}</div>
                        <p className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-surface-sunken p-3 text-ink">{r.content}</p>
                      </div>
                      {r.reportType === "wrong-result" ? (
                        <Mismatch detected={r.detectedVerdict} best={found === "loading" ? "loading" : matches[0]} />
                      ) : (
                        (r.platform || r.detectedVerdict) && (
                          <dl className="grid gap-2 sm:grid-cols-3">
                            {r.platform && (
                              <div>
                                <dt className="text-xs text-ink-faint">{t("Seen on")}</dt>
                                <dd>{r.platform}</dd>
                              </div>
                            )}
                            {r.detectedVerdict && (
                              <div>
                                <dt className="text-xs text-ink-faint">{t("The detector said")}</dt>
                                <dd>{r.detectedVerdict}</dd>
                              </div>
                            )}
                          </dl>
                        )
                      )}
                      {r.reportType === "wrong-result" && r.platform && <p className="text-xs text-ink-faint">{t("Seen on {platform}.", { platform: r.platform })}</p>}
                      {r.message && (
                        <div>
                          <div className="eyebrow">{t("Details")}</div>
                          <p className="mt-2 whitespace-pre-wrap break-words text-ink-muted">{r.message}</p>
                        </div>
                      )}
                      {r.attachment && (
                        <a href={`/api/admin/reports/${r.id}/attachment`} target="_blank" rel="noopener noreferrer" className="block w-fit">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`/api/admin/reports/${r.id}/attachment`}
                            alt={t("Screenshot sent with the report")}
                            className="max-h-80 rounded-lg border border-hairline object-contain"
                          />
                        </a>
                      )}
                    </>
                  ) : (
                    <p className="whitespace-pre-wrap break-words text-ink-muted">{r.message}</p>
                  )}

                  <div>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <div className="eyebrow">{t("In the archive")}</div>
                      <span className="text-xs text-ink-faint">{t("Fact-checks that use the same key words")}</span>
                    </div>
                    {found === "loading" || found === undefined ? (
                      <p className="mt-2 text-sm text-ink-faint">{t("Searching the archive…")}</p>
                    ) : found === "error" ? (
                      <p className="mt-2 text-sm text-verdict-hoax">{t("Could not search the archive.")}</p>
                    ) : matches.length === 0 ? (
                      <p className="mt-2 text-sm text-ink-faint">{t("Nothing in the archive is about this. If it is a real claim, start a draft.")}</p>
                    ) : (
                      <ul className="mt-2 space-y-2">
                        {matches.map((a) => (
                          <li key={a.slug} className="flex flex-wrap items-start gap-3 rounded-lg border border-hairline p-3">
                            <VerdictBadge verdict={a.verdict} className="mt-0.5 shrink-0" />
                            <span className="min-w-0 flex-1">
                              <Link href={`/admin/articles/${a.slug}/edit`} className="block text-sm font-medium leading-snug hover:text-brand">
                                {a.title}
                              </Link>
                              <span className="mt-0.5 block text-xs text-ink-faint">
                                {[a.sourceSite && sourceName(a.sourceSite), dayLabel(a.date, lang), !a.published && t("Hidden")].filter(Boolean).join(" · ")}
                              </span>
                            </span>
                            <span className="flex items-center gap-2">
                              <Link href={`/blog/${a.slug}`} target="_blank" className="px-1 text-ink-faint hover:text-ink" title={t("View on site")} aria-label={t("View on site")}>
                                ↗
                              </Link>
                              {r.resolvedSlug !== a.slug && (
                                <button type="button" onClick={() => void resolve(r, a.slug)} disabled={busy === r.id} className="neu-btn px-3 py-1.5 text-sm disabled:opacity-50">
                                  {t("This answers it")}
                                </button>
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div>
                    <div className="eyebrow">{t("Answered by")}</div>
                    {r.resolvedSlug ? (
                      <p className="mt-2 flex flex-wrap items-center gap-2">
                        <Link href={`/admin/articles/${r.resolvedSlug}/edit`} className="font-medium hover:text-brand">
                          {r.resolvedTitle || r.resolvedSlug}
                        </Link>
                        {!r.resolvedTitle && <span className="text-xs text-verdict-warn">{t("(no article has this address any more)")}</span>}
                        <Link href={`/blog/${r.resolvedSlug}`} target="_blank" className="px-1 text-ink-faint hover:text-ink" title={t("View on site")} aria-label={t("View on site")}>
                          ↗
                        </Link>
                        <button type="button" onClick={() => void patch(r.id, { resolvedSlug: "" })} className="px-2 py-1 text-sm text-ink-muted hover:text-ink">
                          {t("Remove")}
                        </button>
                      </p>
                    ) : (
                      <form
                        className="mt-2 flex flex-wrap items-center gap-2"
                        onSubmit={(e) => {
                          e.preventDefault();
                          void resolve(r, slugInput[r.id] ?? "");
                        }}
                      >
                        <input
                          value={slugInput[r.id] ?? ""}
                          onChange={(e) => setSlugInput((s) => ({ ...s, [r.id]: e.target.value }))}
                          placeholder={t("Article link or web address, e.g. /blog/salah-bantuan-2-juta")}
                          aria-label={t("Article that answers this report")}
                          className={clsx(field, "max-w-md font-mono text-xs")}
                        />
                        <button type="submit" disabled={busy === r.id || !slugFrom(slugInput[r.id] ?? "")} className="neu-btn px-3 py-1.5 text-sm disabled:opacity-50">
                          {t("Link this article")}
                        </button>
                        <span className="text-xs text-ink-faint">{t("This also marks the report as done.")}</span>
                      </form>
                    )}
                  </div>

                  <div>
                    <label className="block">
                      <span className="eyebrow">{t("Private note")}</span>
                      <textarea
                        rows={2}
                        value={notes[r.id] ?? r.note ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          setNotes((n) => ({ ...n, [r.id]: v }));
                          setNoteState((s) => ({ ...s, [r.id]: undefined }));
                        }}
                        placeholder={t("What you checked, who you asked, what is still to do. The sender never sees this.")}
                        className={clsx(field, "mt-2 resize-y")}
                      />
                    </label>
                    <div className="mt-2 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => void saveNote(r)}
                        disabled={noteState[r.id] === "saving" || (notes[r.id] ?? r.note ?? "") === (r.note ?? "")}
                        className="neu-btn px-3 py-1.5 text-sm disabled:opacity-50"
                      >
                        {noteState[r.id] === "saving" ? t("Saving…") : t("Save note")}
                      </button>
                      {noteState[r.id] === "saved" && <span className="text-sm text-verdict-valid">{t("Saved")}</span>}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 border-t border-hairline pt-4">
                    <label className="flex items-center gap-2 text-sm text-ink-muted">
                      {t("Status")}
                      <select
                        value={r.status}
                        onChange={(e) => void patch(r.id, { status: e.target.value as ReportStatus })}
                        className="rounded-lg border border-hairline bg-surface-sunken px-2.5 py-1.5 text-sm text-ink"
                      >
                        {Object.entries(REPORT_STATUSES).map(([key, label]) => (
                          <option key={key} value={key}>
                            {t(label)}
                          </option>
                        ))}
                      </select>
                    </label>
                    {text.trim() && (
                      <>
                        <Link href={prefill("/admin/detect", text)} className="neu-btn px-3 py-1.5 text-sm">
                          {t("Check in detection lab")}
                        </Link>
                        <Link href={prefill("/admin/extract", text)} className="neu-btn px-3 py-1.5 text-sm">
                          {t("Start a draft")}
                        </Link>
                      </>
                    )}
                    {r.email && (
                      <a href={`mailto:${encodeURIComponent(r.email)}?subject=${encodeURIComponent(`Re: ${reportNumber(r.id)} ${title}`)}`} className="neu-btn px-3 py-1.5 text-sm">
                        {t("Reply by email")}
                      </a>
                    )}
                    <button onClick={() => void patch(r.id, { read: false })} className="px-3 py-1.5 text-sm text-ink-muted hover:text-ink">
                      {t("Mark as unread")}
                    </button>
                    <button
                      onClick={() => void remove(r)}
                      disabled={busy === r.id}
                      className="ml-auto rounded-full border border-hairline px-3 py-1.5 text-sm font-medium text-verdict-hoax hover:bg-verdict-hoax/10 disabled:opacity-50"
                    >
                      {busy === r.id ? "…" : t("Delete")}
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** A "wrong result" report: what the detector told the visitor, next to what the archive holds, so a wrong match stands out. */
function Mismatch({ detected, best }: { detected: string; best: ArticleListItem | "loading" | undefined }) {
  const { t } = useAdminT();
  const said = verdictOf(detected);
  const match = best && best !== "loading" ? best : undefined;
  const agree = match && said ? match.verdict === said : null;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="neu-inset p-3">
        <div className="eyebrow">{t("The detector said")}</div>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          {said && <VerdictBadge verdict={said} />}
          <span className={said ? "text-ink-muted" : "text-ink"}>{detected || t("not recorded")}</span>
        </div>
      </div>
      <div className="neu-inset p-3">
        <div className="flex items-baseline justify-between gap-2">
          <div className="eyebrow">{t("Closest article in the archive")}</div>
          {agree !== null && (
            <span className={clsx("rounded-full px-2 py-0.5 text-xs font-semibold", agree ? "bg-verdict-valid/10 text-verdict-valid" : "bg-verdict-warn/10 text-verdict-warn")}>
              {agree ? t("same verdict") : t("different verdict")}
            </span>
          )}
        </div>
        <div className="mt-1.5 flex flex-wrap items-start gap-2">
          {best === "loading" ? (
            <span className="text-sm text-ink-faint">{t("Searching…")}</span>
          ) : match ? (
            <>
              <VerdictBadge verdict={match.verdict} className="shrink-0" />
              <Link href={`/admin/articles/${match.slug}/edit`} className="min-w-0 font-medium leading-snug hover:text-brand">
                {match.title}
              </Link>
            </>
          ) : (
            <span className="text-sm text-ink-faint">{t("Nothing similar in the archive, so the detector answered on its own.")}</span>
          )}
        </div>
      </div>
    </div>
  );
}
