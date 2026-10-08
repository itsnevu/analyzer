"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Pill } from "@/components/ui/Neu";
import { ArchiveIcon, ArrowRightIcon, ShieldIcon, TextIcon } from "@/components/ui/Icons";
import { useI18n } from "@/lib/i18n";
import { PENDING_TEXT_KEY } from "@/lib/pending";
import { formatCount } from "@/lib/sources";
import { clsx } from "@/lib/clsx";

export interface HeroCounts {
  total: number;
  sources: number;
}

export function Hero({ counts }: { counts?: HeroCounts }) {
  const { t, lang } = useI18n();
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

  const trust = [
    counts && counts.total > 0 && { Icon: ArchiveIcon, value: formatCount(counts.total, lang), label: t("hero.trust.archive") },
    counts && counts.sources > 0 && { Icon: ShieldIcon, value: formatCount(counts.sources, lang), label: t("hero.trust.sources") },
    { Icon: TextIcon, value: "", label: t("hero.trust.langs") },
  ].filter((x): x is { Icon: typeof ArchiveIcon; value: string; label: string } => Boolean(x));

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
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-surface/25 via-surface/60 to-surface" />

      <div className="pointer-events-none absolute inset-0 bg-dot-grid opacity-40" />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-80 w-[42rem] -translate-x-1/2 rounded-full bg-brand-gradient opacity-20 blur-[120px]" />

      <div className="container-page relative pb-10 pt-28 sm:pb-14 sm:pt-36">
        <div className="mx-auto max-w-3xl text-center">
          <div className="flex justify-center animate-fade-up motion-reduce:animate-none">
            <Pill>
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-brand-from motion-reduce:animate-none" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-from" />
              </span>
              {t("hero.badge")}
            </Pill>
          </div>

          <h1 className="mt-5 font-display text-4xl font-bold leading-[1.04] tracking-tight text-balance animate-fade-up motion-reduce:animate-none sm:text-6xl">
            {t("hero.title.a")} <span className="gradient-text">{t("hero.title.hoax")}</span>,
            <br className="hidden sm:block" /> {t("hero.title.b")}
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-ink-muted animate-fade-up motion-reduce:animate-none sm:text-lg">
            {t("hero.subtitle")}
          </p>

          {/* Paste box: the detector, one step earlier */}
          <form
            onSubmit={submit}
            className="neu mx-auto mt-8 max-w-2xl p-2 text-left shadow-neu-lg transition-colors focus-within:border-brand/50 animate-fade-up motion-reduce:animate-none"
          >
            <label className="block">
              <span className="sr-only">{t("hero.box.label")}</span>
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
                placeholder={t("hero.box.placeholder")}
                className="w-full resize-none rounded-lg bg-transparent px-4 py-3 text-base leading-relaxed text-ink outline-none placeholder:text-ink-faint sm:text-sm"
              />
            </label>
            <div className="flex flex-col items-stretch gap-2 border-t border-hairline p-2 pt-3 sm:flex-row sm:items-center sm:justify-between">
              <span className={clsx("min-w-0 px-2 text-xs", text && !ready ? "text-verdict-warn" : "text-ink-faint")}>
                {text && !ready ? t("{n} more characters to go", { n: 15 - text.trim().length }) : t("hero.box.hint")}
              </span>
              <div className="flex shrink-0 gap-2">
                <Link href="/#how" className="neu-btn flex-1 whitespace-nowrap px-5 py-2.5 text-center text-sm font-medium sm:flex-none">
                  {t("hero.cta.secondary")}
                </Link>
                <button
                  type="submit"
                  disabled={!ready}
                  className={clsx("btn-primary flex-1 whitespace-nowrap px-6 py-2.5 text-sm sm:flex-none", !ready && "cursor-not-allowed opacity-50 hover:opacity-50")}
                >
                  {t("hero.cta.primary")}
                </button>
              </div>
            </div>
          </form>

          {/* Trust strip: live numbers from the archive */}
          <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-ink-muted">
            {trust.map(({ Icon, value, label }) => (
              <li key={label} className="inline-flex items-center gap-1.5">
                <Icon className="h-4 w-4 text-brand" />
                {value && <strong className="font-semibold tabular-nums text-ink">{value}</strong>}
                {label}
              </li>
            ))}
            <li>
              <Link href="/stats" className="inline-flex items-center gap-1 text-ink-faint transition-colors hover:text-ink">
                {t("All the numbers")} <ArrowRightIcon className="h-3.5 w-3.5" />
              </Link>
            </li>
          </ul>

          <p className="mt-4 text-xs text-ink-faint">{t("hero.disclaimer")}</p>
        </div>
      </div>
    </section>
  );
}
