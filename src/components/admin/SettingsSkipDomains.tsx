"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SkipDomainRow } from "@/lib/settings";

const field = "rounded-lg border border-hairline bg-surface-sunken px-3 py-2 text-sm text-ink outline-none focus:ring-2 focus:ring-brand/30";

/** Domains the link reader refuses; add a hostname or paste a URL. */
export function SettingsSkipDomains({ domains: initial }: { domains: SkipDomainRow[] }) {
  const router = useRouter();
  const [domains, setDomains] = useState(initial);
  const [domain, setDomain] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!domain.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/settings/skip-domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain, note }),
      });
      const data = (await res.json()) as { domains?: SkipDomainRow[]; error?: string };
      if (!res.ok || !data.domains) throw new Error(data.error);
      setDomains(data.domains);
      setDomain("");
      setNote("");
      router.refresh();
    } catch (err) {
      alert(err instanceof Error && err.message ? err.message : "Failed to add.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(d: SkipDomainRow) {
    if (!confirm(`Allow ${d.domain} again?`)) return;
    setDomains((list) => list.filter((x) => x.id !== d.id));
    const res = await fetch(`/api/admin/settings/skip-domains/${d.id}`, { method: "DELETE" });
    if (!res.ok) {
      setDomains((list) => [...list, d].sort((a, b) => a.domain.localeCompare(b.domain)));
      alert("Failed to delete.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-4 space-y-4">
      {domains.length === 0 ? (
        <p className="text-sm text-ink-muted">No domains are skipped.</p>
      ) : (
        <ul className="divide-y divide-hairline rounded-lg border border-hairline">
          {domains.map((d) => (
            <li key={d.id} className="flex items-center gap-3 px-3 py-2 text-sm">
              <span className="font-mono text-xs">{d.domain}</span>
              {d.note && <span className="truncate text-xs text-ink-faint">{d.note}</span>}
              <button onClick={() => remove(d)} className="ml-auto rounded-full border border-hairline px-3 py-1 text-xs font-medium text-verdict-hoax hover:bg-verdict-hoax/10">
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="example.com or https://www.example.com/page" className={`${field} flex-1`} aria-label="Hostname or URL" />
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className={`${field} sm:w-56`} aria-label="Note" />
        <button onClick={add} disabled={busy || !domain.trim()} className="btn-primary px-5 py-2.5 text-sm disabled:opacity-50">
          {busy ? "Adding…" : "Add domain"}
        </button>
      </div>
    </div>
  );
}
