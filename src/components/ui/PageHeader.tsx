"use client";

import { Eyebrow } from "./Neu";
import { useI18n } from "@/lib/i18n";

export function PageHeader({
  eyebrowKey,
  titleKey,
  highlightKey,
  introKey,
  image,
  imageTransparent = false,
}: {
  eyebrowKey: string;
  titleKey: string;
  highlightKey?: string;
  introKey?: string;
  image?: string;
  imageTransparent?: boolean;
}) {
  const { t } = useI18n();
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute -top-32 left-1/2 h-64 w-[36rem] -translate-x-1/2 rounded-full bg-brand-gradient opacity-15 blur-[110px]" />
      <div className="container-page relative pt-16 pb-12 sm:pt-24 sm:pb-16">
        <div className={image ? "grid items-center gap-12 md:grid-cols-[1.05fr_0.95fr]" : ""}>
          <div className={image ? "max-w-xl" : ""}>
            <Eyebrow>{t(eyebrowKey)}</Eyebrow>
            <h1 className="mt-5 max-w-3xl font-display text-4xl font-bold leading-[1.08] tracking-tight text-balance sm:text-5xl">
              {t(titleKey)}
              {highlightKey && (
                <>
                  {" "}
                  <span className="gradient-text">{t(highlightKey)}</span>
                </>
              )}
            </h1>
            {introKey && <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink-muted">{t(introKey)}</p>}
          </div>
          {/* Decorative only; hidden on phones so the page's content starts above the fold. */}
          {image && (
            <div className={`${imageTransparent ? "" : "neu "}relative hidden aspect-[16/10] overflow-hidden p-0 md:block`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image} alt="" className={`absolute inset-0 h-full w-full ${imageTransparent ? "object-contain" : "object-cover"}`} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
