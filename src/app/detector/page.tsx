import type { Metadata } from "next";
import Link from "next/link";
import { DetectorPanel } from "@/components/detector/DetectorPanel";
import { ShieldIcon } from "@/components/ui/Icons";
import { DICT } from "@/lib/dictionary";

export const metadata: Metadata = {
  title: "Hoax Detector",
  description:
    "Paste a news text or chain message and get a hoax assessment with references. Supports Indonesian & English.",
};

/** A focused tool page: a short header, then the input card and the result right under it. */
export default function DetectorPage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -top-32 left-1/2 h-64 w-[36rem] max-w-[100vw] -translate-x-1/2 rounded-full bg-brand-gradient opacity-15 blur-[110px]" />
        <div className="container-page relative pb-8 pt-10 text-center sm:pb-10 sm:pt-16">
          <span className="eyebrow">{DICT["det.eyebrow"]}</span>
          <h1 className="mx-auto mt-4 max-w-3xl font-display text-4xl font-bold leading-[1.05] tracking-tight text-balance sm:text-5xl">
            {DICT["det.title.a"]} <span className="gradient-text">{DICT["det.title.hoax"]}</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-ink-muted sm:text-lg">{DICT["det.intro"]}</p>
        </div>
      </section>
      <section className="container-page pb-12 sm:pb-16">
        <div className="mx-auto max-w-4xl">
          <DetectorPanel />
          <p className="mt-8 flex items-center justify-center gap-2 text-center text-xs text-ink-faint">
            <ShieldIcon className="h-4 w-4 shrink-0 text-brand" />
            <span>
              Results are predictions. Open the matching fact-checks and references before you share.{" "}
              <Link href="/#how" className="underline hover:text-ink">
                How it works
              </Link>
            </span>
          </p>
        </div>
      </section>
    </>
  );
}
