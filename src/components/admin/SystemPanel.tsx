"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { clsx } from "@/lib/clsx";

/**
 * The only interactive part of /admin/system: one button per maintenance
 * action. Each asks for confirmation when told to, posts to
 * /api/admin/system/<action>, shows the outcome and refreshes the server-rendered cards.
 */

export type SystemActionKey = "backup" | "purge-ips" | "rebuild-index" | "optimize";

export function SystemActionButton({
  action,
  label,
  busyLabel = "Working…",
  confirmText,
  primary = false,
  disabled = false,
}: {
  action: SystemActionKey;
  label: string;
  busyLabel?: string;
  /** Asked before running; leave out for actions that cannot lose anything. */
  confirmText?: string;
  primary?: boolean;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  async function run() {
    if (busy || disabled) return;
    if (confirmText && !confirm(confirmText)) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch(`/api/admin/system/${action}`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setResult({ ok: true, text: data.message ?? "Done." });
      router.refresh();
    } catch (err) {
      setResult({ ok: false, text: err instanceof Error ? err.message : "The action failed." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={run}
        disabled={busy || disabled}
        aria-busy={busy}
        className={clsx(
          "text-sm disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
          primary ? "btn-primary px-4 py-2" : "neu-btn px-4 py-2",
        )}
      >
        {busy && <span className="mr-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent align-[-1px]" aria-hidden />}
        {busy ? busyLabel : label}
      </button>
      {result && (
        <p role="status" className={clsx("text-xs", result.ok ? "text-verdict-valid" : "text-verdict-hoax")}>
          {result.text}
        </p>
      )}
    </div>
  );
}
