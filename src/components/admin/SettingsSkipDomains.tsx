"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SkipDomainRow } from "@/lib/settings";
import { clsx } from "@/lib/clsx";
import { DataGrid, type GridColumn } from "@/components/admin/DataGrid";

const field = "h-7 rounded-md border border-hairline bg-surface-raised px-2 text-xs text-ink outline-none focus:ring-2 focus:ring-brand/30";
const pill = "whitespace-nowrap rounded-full border border-hairline px-3 py-1 text-xs font-medium hover:border-ink disabled:opacity-50";

/** Domains the link reader refuses, on the panel grid; add a hostname or paste a URL, edit or delete inline. */
export function SettingsSkipDomains({ domains: initial }: { domains: SkipDomainRow[] }) {
  const router = useRouter();
  const [domains, setDomains] = useState(initial);
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState({ domain: "", note: "" });
  const [fresh, setFresh] = useState({ domain: "", note: "" });
  const [busy, setBusy] = useState(false);

  async function send(url: string, method: string, body: { domain: string; note: string }) {
    setBusy(true);
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = (await res.json()) as { domains?: SkipDomainRow[]; error?: string };
      if (!res.ok || !data.domains) throw new Error(data.error);
      setDomains(data.domains);
      router.refresh();
      return true;
    } catch (err) {
      alert(err instanceof Error && err.message ? err.message : "Failed to save.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function add() {
    if (!fresh.domain.trim()) return;
    if (await send("/api/admin/settings/skip-domains", "POST", fresh)) setFresh({ domain: "", note: "" });
  }

  async function save(id: number) {
    if (!draft.domain.trim()) return alert("The hostname is required.");
    if (await send(`/api/admin/settings/skip-domains/${id}`, "PUT", draft)) setEditing(null);
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

  const columns: GridColumn<SkipDomainRow>[] = [
    {
      key: "domain",
      header: "Domain",
      width: "260px",
      render: (d) =>
        editing === d.id ? (
          <input
            value={draft.domain}
            onChange={(e) => setDraft({ ...draft, domain: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && save(d.id)}
            className={clsx(field, "w-full font-mono")}
            aria-label="Domain"
          />
        ) : (
          <span className="font-mono text-xs">{d.domain}</span>
        ),
    },
    {
      key: "note",
      header: "Note",
      render: (d) =>
        editing === d.id ? (
          <input
            value={draft.note}
            onChange={(e) => setDraft({ ...draft, note: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && save(d.id)}
            className={clsx(field, "w-full")}
            aria-label="Note"
          />
        ) : (
          <span className="text-xs text-ink-muted">{d.note || <span className="text-ink-faint">—</span>}</span>
        ),
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      width: "160px",
      align: "right",
      render: (d) =>
        editing === d.id ? (
          <div className="flex justify-end gap-1.5">
            <button type="button" onClick={() => save(d.id)} disabled={busy} className="btn-primary px-3 py-1 text-xs disabled:opacity-50">
              Save
            </button>
            <button type="button" onClick={() => setEditing(null)} className={pill}>
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex justify-end gap-1.5">
            <button
              type="button"
              onClick={() => {
                setEditing(d.id);
                setDraft({ domain: d.domain, note: d.note });
              }}
              className={pill}
            >
              Edit
            </button>
            <button type="button" onClick={() => remove(d)} className={clsx(pill, "text-verdict-hoax hover:bg-verdict-hoax/10")}>
              Delete
            </button>
          </div>
        ),
    },
  ];

  return (
    <DataGrid
      caption={`${domains.length} skipped`}
      columns={columns}
      rows={domains}
      rowKey={(d) => String(d.id)}
      toolbar={
        <form
          className="flex flex-wrap items-center gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <input
            value={fresh.domain}
            onChange={(e) => setFresh({ ...fresh, domain: e.target.value })}
            placeholder="example.com or a URL"
            className={clsx(field, "w-52")}
            aria-label="Hostname or URL"
          />
          <input value={fresh.note} onChange={(e) => setFresh({ ...fresh, note: e.target.value })} placeholder="Note (optional)" className={clsx(field, "w-40")} aria-label="Note" />
          <button type="submit" disabled={busy || !fresh.domain.trim()} className="btn-primary px-3 py-1 text-xs disabled:opacity-50">
            {busy ? "Adding…" : "+ Add domain"}
          </button>
        </form>
      }
      emptyMessage="No domains are skipped."
      dense
    />
  );
}
