"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Report } from "@/lib/reports";

export function ReportsList({ reports }: { reports: Report[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<number | null>(null);

  async function remove(id: number, subject: string) {
    if (!confirm(`Delete report "${subject}"? This cannot be undone.`)) return;
    setBusy(id);
    try {
      const res = await fetch(`/api/admin/reports/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      alert("Failed to delete.");
    } finally {
      setBusy(null);
    }
  }

  if (reports.length === 0) {
    return <div className="neu p-10 text-center text-sm text-ink-muted">No reports yet.</div>;
  }

  return (
    <ul className="space-y-3">
      {reports.map((r) => (
        <li key={r.id} className="neu p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-medium">{r.subject}</div>
              <div className="text-xs text-ink-faint">
                {[r.firstName, r.lastName].filter(Boolean).join(" ")} ·{" "}
                <a href={`mailto:${r.email}`} className="hover:text-brand">{r.email}</a> · {r.createdAt} UTC
              </div>
            </div>
            <button
              onClick={() => remove(r.id, r.subject)}
              disabled={busy === r.id}
              className="rounded-full border border-hairline px-3 py-1.5 text-xs font-medium text-verdict-hoax hover:bg-verdict-hoax/10 disabled:opacity-50"
            >
              {busy === r.id ? "…" : "Delete"}
            </button>
          </div>
          <p className="mt-3 whitespace-pre-wrap break-words text-sm text-ink-muted">{r.message}</p>
        </li>
      ))}
    </ul>
  );
}
