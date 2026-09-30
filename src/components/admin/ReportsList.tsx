"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { REPORT_STATUSES, REPORT_TYPES, reportNumber, type Report, type ReportStatus, type ReportType } from "@/lib/report-labels";
import { PENDING_TEXT_KEY } from "@/lib/pending";
import { clsx } from "@/lib/clsx";

const STATUS_STYLE: Record<ReportStatus, string> = {
  new: "bg-verdict-hoax/10 text-verdict-hoax",
  "in-progress": "bg-verdict-warn/10 text-verdict-warn",
  done: "bg-verdict-valid/10 text-verdict-valid",
};

export function ReportsList({ reports }: { reports: Report[] }) {
  const router = useRouter();
  const [open, setOpen] = useState<number | null>(null);
  const [items, setItems] = useState(reports);
  const [busy, setBusy] = useState<number | null>(null);

  async function patch(id: number, change: { status?: ReportStatus; read?: boolean }) {
    setItems((list) =>
      list.map((r) =>
        r.id === id
          ? { ...r, ...(change.status ? { status: change.status } : {}), ...(change.read === undefined ? {} : { readAt: change.read ? r.readAt ?? "now" : null }) }
          : r,
      ),
    );
    await fetch(`/api/admin/reports/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(change),
    });
    router.refresh();
  }

  function toggle(r: Report) {
    const next = open === r.id ? null : r.id;
    setOpen(next);
    if (next && !r.readAt) void patch(r.id, { read: true });
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
      alert("Failed to delete.");
    } finally {
      setBusy(null);
    }
  }

  function checkInDetector(text: string) {
    try {
      sessionStorage.setItem(PENDING_TEXT_KEY, text);
    } catch {
      /* storage unavailable */
    }
    router.push("/detector?run=1");
  }

  if (items.length === 0) {
    return <div className="neu p-10 text-center text-sm text-ink-muted">Nothing here yet.</div>;
  }

  return (
    <ul className="space-y-3">
      {items.map((r) => {
        const isReport = r.kind === "report";
        const title = isReport ? REPORT_TYPES[r.reportType as ReportType] ?? "Report" : r.subject || "Message";
        const from = [r.firstName, r.lastName].filter(Boolean).join(" ") || "Anonymous";
        const preview = (isReport ? r.content : r.message).replace(/\s+/g, " ");
        const expanded = open === r.id;
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
                  {r.attachment && <span className="text-xs text-ink-faint">📎 screenshot</span>}
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
                  {isReport && (
                    <button onClick={() => checkInDetector(r.content)} className="neu-btn px-3 py-1.5 text-xs">
                      Check in detector
                    </button>
                  )}
                  {r.email && (
                    <a href={`mailto:${r.email}?subject=${encodeURIComponent(`Re: ${reportNumber(r.id)} ${title}`)}`} className="neu-btn px-3 py-1.5 text-xs">
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
  );
}
