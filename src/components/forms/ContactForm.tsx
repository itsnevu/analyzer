"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { clsx } from "@/lib/clsx";

const field =
  "w-full rounded-xl bg-surface-sunken px-4 py-3 text-sm text-ink shadow-neu-inset-sm outline-none placeholder:text-ink-faint focus:ring-2 focus:ring-brand-from/40";

export function ContactForm({ variant = "contact" }: { variant?: "contact" | "report" }) {
  const { t } = useI18n();
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
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
    <form onSubmit={onSubmit} className="neu space-y-5 p-6 sm:p-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-ink-muted">{t("form.firstName")} *</span>
          <input name="firstName" required placeholder={t("form.firstName")} className={field} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-ink-muted">{t("form.lastName")}</span>
          <input name="lastName" placeholder={t("form.lastName")} className={field} />
        </label>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-ink-muted">{t("form.email")} *</span>
        <input name="email" type="email" required placeholder="you@email.com" className={field} />
        <span className="mt-1 block text-xs text-ink-faint">{t("form.emailHint")}</span>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-ink-muted">{t("form.subject")} *</span>
        <input name="subject" required placeholder={t("form.subject")} className={field} />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-ink-muted">{t("form.message")} *</span>
        <textarea name="message" required rows={5} placeholder={t("form.message")} className={clsx(field, "resize-none")} />
      </label>

      <button type="submit" disabled={status === "sending"} className="btn-primary w-full py-3.5">
        {status === "sending" ? t("form.sending") : variant === "report" ? t("form.sendReport") : t("form.sendMessage")}
      </button>

      {status === "ok" && (
        <p className="rounded-xl border border-verdict-valid/30 bg-verdict-valid/10 px-4 py-3 text-sm text-verdict-valid">
          {msg}
        </p>
      )}
      {status === "error" && (
        <p className="rounded-xl border border-verdict-hoax/30 bg-verdict-hoax/10 px-4 py-3 text-sm text-verdict-hoax">
          {msg}
        </p>
      )}
    </form>
  );
}
