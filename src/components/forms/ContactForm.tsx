"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { clsx } from "@/lib/clsx";

export const fieldClass =
  "w-full rounded-xl bg-surface-sunken px-4 py-3 text-sm text-ink shadow-neu-inset-sm outline-none placeholder:text-ink-faint focus:ring-2 focus:ring-brand-from/40";

/** Hidden from people (and from screen readers); bots that fill every field give themselves away. */
export function Honeypot() {
  return (
    <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
      <label>
        Website
        <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
      </label>
    </div>
  );
}

export function FormStatus({ status, message }: { status: "idle" | "sending" | "ok" | "error"; message: string }) {
  if (status === "ok")
    return (
      <p role="status" className="rounded-xl border border-verdict-valid/30 bg-verdict-valid/10 px-4 py-3 text-sm text-verdict-valid">
        {message}
      </p>
    );
  if (status === "error")
    return (
      <p role="alert" className="rounded-xl border border-verdict-hoax/30 bg-verdict-hoax/10 px-4 py-3 text-sm text-verdict-hoax">
        {message}
      </p>
    );
  return null;
}

/** General contact form; hoax reports have their own form (ReportForm). */
export function ContactForm() {
  const { t } = useI18n();
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = { ...Object.fromEntries(new FormData(form).entries()), kind: "contact" };
    setStatus("sending");
    setMsg("");
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to send.");
      setStatus("ok");
      setMsg(json.message ?? "Sent.");
      form.reset();
    } catch (err) {
      setStatus("error");
      setMsg(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  return (
    <form onSubmit={onSubmit} className="neu relative space-y-5 p-6 sm:p-8">
      <Honeypot />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-ink-muted">{t("form.firstName")} *</span>
          <input name="firstName" required maxLength={80} autoComplete="given-name" placeholder={t("form.firstName")} className={fieldClass} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-ink-muted">{t("form.lastName")}</span>
          <input name="lastName" maxLength={80} autoComplete="family-name" placeholder={t("form.lastName")} className={fieldClass} />
        </label>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-ink-muted">{t("form.email")} *</span>
        <input name="email" type="email" required maxLength={200} autoComplete="email" placeholder="you@email.com" className={fieldClass} />
        <span className="mt-1 block text-xs text-ink-faint">{t("form.emailHint")}</span>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-ink-muted">{t("form.subject")} *</span>
        <input name="subject" required maxLength={200} placeholder={t("form.subject")} className={fieldClass} />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-ink-muted">{t("form.message")} *</span>
        <textarea name="message" required rows={5} maxLength={5000} placeholder={t("form.message")} className={clsx(fieldClass, "resize-none")} />
      </label>

      <button type="submit" disabled={status === "sending"} className="btn-primary w-full py-3.5">
        {status === "sending" ? t("form.sending") : t("form.sendMessage")}
      </button>

      <FormStatus status={status} message={msg} />
    </form>
  );
}
