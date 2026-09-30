"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Pill } from "@/components/ui/Neu";
import { useI18n } from "@/lib/i18n";
import { PENDING_TEXT_KEY } from "@/lib/pending";
import { clsx } from "@/lib/clsx";

export function Hero() {
  const { t } = useI18n();
  const router = useRouter();
  const [text, setText] = useState("");
  const ready = text.trim().length >= 15;

  // The text travels to the detector through sessionStorage, so long pastes never hit a URL limit.
  function go() {
    if (!ready) return;
    try {
      sessionStorage.setItem(PENDING_TEXT_KEY, text);
    } catch {
      /* storage unavailable; the detector opens empty */
    }
    router.push("/detector?run=1");
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    go();
  }

  return (
    <section className="relative -mt-[84px] overflow-hidden">
      {/* Generated looping background video (Higgsfield · Seedance) */}
      <video
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-[0.6] motion-reduce:hidden [mask-image:radial-gradient(130%_100%_at_50%_0%,black,transparent_80%)]"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        poster="/hero-poster.jpg?v=2"
      >
        <source src="/hero.mp4?v=2" type="video/mp4" />
      </video>
      {/* Dark overlay so hero text stays legible on top of the video */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-surface/25 via-surface/55 to-surface" />

      <div className="pointer-events-none absolute inset-0 bg-dot-grid opacity-40" />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-80 w-[42rem] -translate-x-1/2 rounded-full bg-brand-gradient opacity-20 blur-[120px]" />

      <div className="container-page relative pt-32 pb-16 sm:pt-40">
        <div className="mx-auto max-w-3xl text-center">
          <div className="flex justify-center animate-fade-up">
            <Pill>
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-brand-from" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-from" />
              </span>
              {t("hero.badge")}
            </Pill>
          </div>

          <h1 className="mt-6 font-display text-4xl font-bold leading-[1.05] tracking-tight text-balance animate-fade-up sm:text-6xl">
            {t("hero.title.a")} <span className="gradient-text">{t("hero.title.hoax")}</span>,
            <br className="hidden sm:block" /> {t("hero.title.b")}
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-ink-muted animate-fade-up">
            {t("hero.subtitle")}
          </p>

          {/* Paste box: the detector, one step earlier */}
          <form onSubmit={submit} className="neu mx-auto mt-9 max-w-2xl p-2 text-left animate-fade-up">
            <label className="block">
              <span className="sr-only">Text to check</span>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                    e.preventDefault();
                    go();
                  }
                }}
                rows={3}
                placeholder="Paste the message, headline, or article you're not sure about…"
                className="w-full resize-none rounded-lg bg-transparent px-4 py-3 text-sm leading-relaxed text-ink outline-none placeholder:text-ink-faint"
              />
            </label>
            <div className="flex flex-col items-stretch gap-2 border-t border-hairline p-2 pt-3 sm:flex-row sm:items-center sm:justify-between">
              <span className={clsx("px-2 text-xs", text && !ready ? "text-verdict-warn" : "text-ink-faint")}>
                {text && !ready ? `${15 - text.trim().length} more characters to go` : "At least 15 characters."}
              </span>
              <div className="flex gap-2">
                <Link href="/#how" className="neu-btn px-5 py-2.5 text-center text-sm font-medium">
                  {t("hero.cta.secondary")}
                </Link>
                <button type="submit" disabled={!ready} className={clsx("btn-primary px-6 py-2.5 text-sm", !ready && "cursor-not-allowed opacity-50 hover:opacity-50")}>
                  {t("hero.cta.primary")}
                </button>
              </div>
            </div>
          </form>

          <p className="mt-6 text-xs text-ink-faint">{t("hero.disclaimer")}</p>
        </div>
      </div>
    </section>
  );
}
