"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { VerdictBadge } from "@/components/article/ArticleCard";
import { clsx } from "@/lib/clsx";
import type { ArticleListItem } from "@/lib/data";
import type { Verdict } from "@/lib/detect";
import { REPORT_STATUSES, REPORT_TYPES, reportNumber, type Report, type ReportStatus, type ReportType } from "@/lib/report-labels";
import { formatDate, sourceName } from "@/lib/sources";

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

export function ReportsList({ reports }: { reports: Report[] }) {
  const router = useRouter();
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
      if (!res.ok) throw new Error(json.error ?? "The change was not saved.");
      if (json.report) setItems((list) => list.map((r) => (r.id === id ? { ...r, ...json.report } : r)));
      router.refresh();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "The change was not saved.");
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
    if (!confirm(`Delete ${reportNumber(r.id)}? This cannot be undone.`)) return;
    setBusy(r.id);
    try {
      const res = await fetch(`/api/admin/reports/${r.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setItems((list) => list.filter((x) => x.id !== r.id));
      router.refresh();
    } catch {
      setError("Failed to delete.");
    } finally {
      setBusy(null);
    }
  }

  if (items.length === 0) {
    return <div className="neu p-10 text-center text-sm text-ink-muted">Nothing here.</div>;
  }

  return (
    <div className="space-y-3">
      {error && <p className="rounded-lg border border-verdict-hoax/30 bg-verdict-hoax/10 px-4 py-2.5 text-sm text-verdict-hoax">{error}</p>}
      <ul className="space-y-3">
        {items.map((r) => {
          const isReport = r.kind === "report";
          const title = isReport ? REPORT_TYPES[r.reportType as ReportType] ?? "Report" : r.subject || "Message";
          const from = [r.firstName, r.lastName].filter(Boolean).join(" ") || "Anonymous";
          const text = isReport ? r.content : r.message;
          const preview = text.replace(/\s+/g, " ");
          const expanded = open === r.id;
          const found = similar[r.id];
          const matches = Array.isArray(found) ? found : [];
          return (
            <li key={r.id} className={clsx("neu overflow-hidden p-0", !r.readAt && "ring-1 ring-verdict-hoax/30")}>
              <button onClick={() => toggle(r)} className="flex w-full items-start gap-3 p-5 text-left" aria-expanded={expanded}>
                <span className={clsx("mt-1.5 h-2 w-2 shrink-0 rounded-full", r.readAt ? "bg-transparent" : "bg-verdict-hoax")} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-ink-faint">{reportNumber(r.id)}</span>
                    <span className="font-medium">{title}</span>
                    <span className={clsx("rounded-full px-2 py-0.5 text-[11px] font-semibold", STATUS_STYLE[r.status] ?? STATUS_STYLE.new)}>
                      {REPORT_STATUSES[r.status] ?? r.status}
                    </span>
                    {r.resolvedSlug && <span className="text-xs text-ink-faint">answered by “{r.resolvedTitle || r.resolvedSlug}”</span>}
                    {r.note && <span className="text-xs text-ink-faint">has a note</span>}
                    {r.attachment && <span className="text-xs text-ink-faint">screenshot</span>}
                  </span>
                  <span className="mt-1 block truncate text-sm text-ink-muted">{preview}</span>
                  <span className="mt-1 block text-xs text-ink-faint">
                    {from}
                    {r.email && ` · ${r.email}`} · {r.createdAt} UTC
                  </span>
                </span>
              </button>

              {expanded && (
                <div className="space-y-4 border-t border-hairline px-5 pb-5 pt-4 text-sm">
                  {isReport ? (
                    <>
                      <div>
                        <div className="eyebrow">Reported text or link</div>
                        <p className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-surface-sunken p-3 text-ink">{r.content}</p>
                      </div>
                      {r.reportType === "wrong-result" ? (
                        <Mismatch detected={r.detectedVerdict} best={found === "loading" ? "loading" : matches[0]} />
                      ) : (
                        (r.platform || r.detectedVerdict) && (
                          <dl className="grid gap-2 sm:grid-cols-3">
                            {r.platform && (
                              <div>
                                <dt className="text-xs text-ink-faint">Seen on</dt>
                                <dd>{r.platform}</dd>
                              </div>
                            )}
                            {r.detectedVerdict && (
                              <div>
                                <dt className="text-xs text-ink-faint">Detector said</dt>
                                <dd>{r.detectedVerdict}</dd>
                              </div>
                            )}
                          </dl>
                        )
                      )}
                      {r.reportType === "wrong-result" && r.platform && <p className="text-xs text-ink-faint">Seen on {r.platform}.</p>}
                      {r.message && (
                        <div>
                          <div className="eyebrow">Details</div>
                          <p className="mt-2 whitespace-pre-wrap break-words text-ink-muted">{r.message}</p>
                        </div>
                      )}
                      {r.attachment && (
                        <a href={`/api/admin/reports/${r.id}/attachment`} target="_blank" rel="noopener noreferrer" className="block w-fit">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`/api/admin/reports/${r.id}/attachment`}
                            alt="Screenshot attached to the report"
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
                      <div className="eyebrow">In the archive</div>
                      <span className="text-xs text-ink-faint">Fact-checks that share this text&apos;s key words</span>
                    </div>
                    {found === "loading" || found === undefined ? (
                      <p className="mt-2 text-xs text-ink-faint">Searching the archive…</p>
                    ) : found === "error" ? (
                      <p className="mt-2 text-xs text-verdict-hoax">The archive could not be searched.</p>
                    ) : matches.length === 0 ? (
                      <p className="mt-2 text-xs text-ink-faint">Nothing in the archive shares this text&apos;s key words. If it is a real claim, create a draft.</p>
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
                                {[a.sourceSite && sourceName(a.sourceSite), formatDate(a.date), !a.published && "hidden"].filter(Boolean).join(" · ")}
                              </span>
                            </span>
                            <span className="flex items-center gap-2">
                              <Link href={`/blog/${a.slug}`} target="_blank" className="text-ink-faint hover:text-ink" title="Open on the site">
                                ↗
                              </Link>
                              {r.resolvedSlug !== a.slug && (
                                <button type="button" onClick={() => void resolve(r, a.slug)} disabled={busy === r.id} className="neu-btn px-3 py-1.5 text-xs disabled:opacity-50">
                                  Resolve with this
                                </button>
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div>
                    <div className="eyebrow">Resolution</div>
                    {r.resolvedSlug ? (
                      <p className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="text-ink-muted">Answered by</span>
                        <Link href={`/admin/articles/${r.resolvedSlug}/edit`} className="font-medium hover:text-brand">
                          {r.resolvedTitle || r.resolvedSlug}
                        </Link>
                        {!r.resolvedTitle && <span className="text-xs text-verdict-warn">(no article has this slug any more)</span>}
                        <Link href={`/blog/${r.resolvedSlug}`} target="_blank" className="text-ink-faint hover:text-ink" title="Open on the site">
                          ↗
                        </Link>
                        <button type="button" onClick={() => void patch(r.id, { resolvedSlug: "" })} className="text-xs text-ink-muted hover:text-ink">
                          Clear
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
                          placeholder="Article slug or link, e.g. /blog/salah-bantuan-2-juta"
                          className={clsx(field, "max-w-md font-mono text-xs")}
                        />
                        <button type="submit" disabled={busy === r.id || !slugFrom(slugInput[r.id] ?? "")} className="neu-btn px-3 py-1.5 text-xs disabled:opacity-50">
                          Resolve with article
                        </button>
                        <span className="text-xs text-ink-faint">Marks the report done.</span>
                      </form>
                    )}
                  </div>

                  <div>
                    <label className="block">
                      <span className="eyebrow">Internal note</span>
                      <textarea
                        rows={2}
                        value={notes[r.id] ?? r.note ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          setNotes((n) => ({ ...n, [r.id]: v }));
                          setNoteState((s) => ({ ...s, [r.id]: undefined }));
                        }}
                        placeholder="What you checked, who you asked, what is left to do. Not shown to the reporter."
                        className={clsx(field, "mt-2 resize-y")}
                      />
                    </label>
                    <div className="mt-2 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => void saveNote(r)}
                        disabled={noteState[r.id] === "saving" || (notes[r.id] ?? r.note ?? "") === (r.note ?? "")}
                        className="neu-btn px-3 py-1.5 text-xs disabled:opacity-50"
                      >
                        {noteState[r.id] === "saving" ? "Saving…" : "Save note"}
                      </button>
                      {noteState[r.id] === "saved" && <span className="text-xs text-verdict-valid">Saved.</span>}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 border-t border-hairline pt-4">
                    <label className="flex items-center gap-2 text-xs text-ink-muted">
                      Status
                      <select
                        value={r.status}
                        onChange={(e) => void patch(r.id, { status: e.target.value as ReportStatus })}
                        className="rounded-lg border border-hairline bg-surface-sunken px-2.5 py-1.5 text-xs text-ink"
                      >
                        {Object.entries(REPORT_STATUSES).map(([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    {text.trim() && (
                      <>
                        <Link href={prefill("/admin/detect", text)} className="neu-btn px-3 py-1.5 text-xs">
                          Check in detection lab
                        </Link>
                        <Link href={prefill("/admin/extract", text)} className="neu-btn px-3 py-1.5 text-xs">
                          Create draft
                        </Link>
                      </>
                    )}
                    {r.email && (
                      <a href={`mailto:${encodeURIComponent(r.email)}?subject=${encodeURIComponent(`Re: ${reportNumber(r.id)} ${title}`)}`} className="neu-btn px-3 py-1.5 text-xs">
                        Reply by email
                      </a>
                    )}
                    <button onClick={() => void patch(r.id, { read: false })} className="px-3 py-1.5 text-xs text-ink-muted hover:text-ink">
                      Mark unread
                    </button>
                    <button
                      onClick={() => void remove(r)}
                      disabled={busy === r.id}
                      className="ml-auto rounded-full border border-hairline px-3 py-1.5 text-xs font-medium text-verdict-hoax hover:bg-verdict-hoax/10 disabled:opacity-50"
                    >
                      {busy === r.id ? "…" : "Delete"}
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
  const said = verdictOf(detected);
  const match = best && best !== "loading" ? best : undefined;
  const agree = match && said ? match.verdict === said : null;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="neu-inset p-3">
        <div className="eyebrow">Detector said</div>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          {said && <VerdictBadge verdict={said} />}
          <span className={said ? "text-ink-muted" : "text-ink"}>{detected || "not recorded"}</span>
        </div>
      </div>
      <div className="neu-inset p-3">
        <div className="flex items-baseline justify-between gap-2">
          <div className="eyebrow">Archive&apos;s best match</div>
          {agree !== null && (
            <span className={clsx("rounded-full px-2 py-0.5 text-[11px] font-semibold", agree ? "bg-verdict-valid/10 text-verdict-valid" : "bg-verdict-warn/10 text-verdict-warn")}>
              {agree ? "same verdict" : "different verdict"}
            </span>
          )}
        </div>
        <div className="mt-1.5 flex flex-wrap items-start gap-2">
          {best === "loading" ? (
            <span className="text-xs text-ink-faint">Searching…</span>
          ) : match ? (
            <>
              <VerdictBadge verdict={match.verdict} className="shrink-0" />
              <Link href={`/admin/articles/${match.slug}/edit`} className="min-w-0 font-medium leading-snug hover:text-brand">
                {match.title}
              </Link>
            </>
          ) : (
            <span className="text-xs text-ink-faint">Nothing similar in the archive, so the engine answered alone.</span>
          )}
        </div>
      </div>
    </div>
  );
}
