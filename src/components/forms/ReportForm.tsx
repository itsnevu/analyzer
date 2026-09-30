"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { REPORT_DRAFT_KEY, type ReportDraft, type ReportType } from "@/lib/report-labels";
import { FormStatus, Honeypot, fieldClass } from "./ContactForm";
import { clsx } from "@/lib/clsx";

const TYPES: { key: ReportType; title: string; hint: string }[] = [
  { key: "hoax", title: "I found a possible hoax", hint: "A message, post or article you want checked." },
  { key: "wrong-result", title: "The detector got it wrong", hint: "A result that seems incorrect." },
  { key: "correction", title: "A fact-check needs fixing", hint: "An error in one of our archive articles." },
];
const PLATFORMS = ["WhatsApp", "Facebook", "Instagram", "TikTok", "X / Twitter", "YouTube", "Telegram", "Website", "Other"];

export function ReportForm() {
  const [type, setType] = useState<ReportType>("hoax");
  const [content, setContent] = useState("");
  const [detectedVerdict, setDetectedVerdict] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "error">("idle");
  const [msg, setMsg] = useState("");
  const [number, setNumber] = useState("");

  // "This result is wrong" on the detector leaves a draft here.
  /* eslint-disable react-hooks/set-state-in-effect -- one-time read of browser-only storage after hydration */
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(REPORT_DRAFT_KEY);
      if (!raw) return;
      sessionStorage.removeItem(REPORT_DRAFT_KEY);
      const draft = JSON.parse(raw) as ReportDraft;
      if (draft.reportType) setType(draft.reportType);
      if (draft.content) setContent(draft.content.slice(0, 10000));
      if (draft.detectedVerdict) setDetectedVerdict(draft.detectedVerdict);
    } catch {
      /* no draft */
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    data.set("kind", "report");
    data.set("reportType", type);
    if (detectedVerdict) data.set("detectedVerdict", detectedVerdict);
    const file = data.get("screenshot");
    if (file instanceof File && file.size > 5 * 1024 * 1024) {
      setStatus("error");
      setMsg("The screenshot is larger than 5 MB.");
      return;
    }
    setStatus("sending");
    setMsg("");
    try {
      const res = await fetch("/api/report", { method: "POST", body: data });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to send.");
      setStatus("ok");
      setMsg(json.message ?? "Sent.");
      setNumber(json.number ?? "");
      form.reset();
      setContent("");
      setDetectedVerdict("");
    } catch (err) {
      setStatus("error");
      setMsg(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  if (status === "ok") {
    return (
      <div className="neu space-y-4 p-6 text-center sm:p-8">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-faint">Report received</div>
        {number && <div className="font-mono text-3xl font-bold">{number}</div>}
        <p className="text-sm text-ink-muted">{msg} Keep this number if you want to ask about it later.</p>
        <div className="flex flex-wrap justify-center gap-2">
          <button onClick={() => setStatus("idle")} className="neu-btn px-5 py-2.5 text-sm">
            Send another report
          </button>
          <Link href="/detector" className="btn-primary px-5 py-2.5 text-sm">
            Check something else
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="neu relative space-y-5 p-6 sm:p-8" encType="multipart/form-data">
      <Honeypot />

      <fieldset>
        <legend className="mb-2 text-xs font-medium text-ink-muted">What are you reporting? *</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {TYPES.map((t) => (
            <label
              key={t.key}
              className={clsx(
                "cursor-pointer rounded-xl border p-3 text-sm transition-colors",
                type === t.key ? "border-ink bg-surface-sunken" : "border-hairline hover:border-ink/40",
              )}
            >
              <input type="radio" name="reportTypeChoice" value={t.key} checked={type === t.key} onChange={() => setType(t.key)} className="sr-only" />
              <span className="block font-medium text-ink">{t.title}</span>
              <span className="mt-0.5 block text-xs text-ink-faint">{t.hint}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-ink-muted">
          {type === "correction" ? "Link to the article and what is wrong *" : "The message, headline or link *"}
        </span>
        <textarea
          name="content"
          required
          minLength={10}
          maxLength={10000}
          rows={5}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Paste it here…"
          className={clsx(fieldClass, "resize-y")}
        />
        {detectedVerdict && (
          <span className="mt-1 block text-xs text-ink-faint">
            The detector rated this <strong>{detectedVerdict}</strong>. Tell us below why you think that is wrong.
          </span>
        )}
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-ink-muted">Where did you see it?</span>
          <select name="platform" defaultValue="" className={fieldClass}>
            <option value="">Choose…</option>
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-ink-muted">Screenshot (optional, max 5 MB)</span>
          <input
            type="file"
            name="screenshot"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="block w-full text-xs text-ink-muted file:mr-3 file:rounded-full file:border-0 file:bg-surface-sunken file:px-4 file:py-2 file:text-xs file:font-medium file:text-ink"
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-ink-muted">Anything else we should know?</span>
        <textarea name="message" rows={3} maxLength={5000} className={clsx(fieldClass, "resize-y")} />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-ink-muted">Your name (optional)</span>
          <input name="name" maxLength={80} autoComplete="name" className={fieldClass} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-ink-muted">Email (optional, for a reply)</span>
          <input name="email" type="email" maxLength={200} autoComplete="email" placeholder="you@email.com" className={fieldClass} />
        </label>
      </div>

      <button type="submit" disabled={status === "sending"} className="btn-primary w-full py-3.5">
        {status === "sending" ? "Sending…" : "Send report"}
      </button>
      <p className="text-center text-xs text-ink-faint">Screenshots are re-saved without their location data. Only the admin can see them.</p>

      <FormStatus status={status} message={msg} />
    </form>
  );
}
