"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import { DISCLAIMER_POINTS } from "@/lib/dictionary";
import { useI18n } from "@/lib/i18n";

export default function DisclaimerPage() {
  const { lang } = useI18n();
  return (
    <>
      <PageHeader eyebrowKey="disclaimer.eyebrow" titleKey="disclaimer.title" introKey="disclaimer.intro" />
      <section className="container-page pb-8">
        <div className="mx-auto max-w-3xl space-y-3">
          {DISCLAIMER_POINTS[lang].map((p, i) => (
            <div key={i} className="neu flex gap-4 p-5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-brand-gradient text-sm font-bold text-white">
                {i + 1}
              </span>
              <p className="text-sm leading-relaxed text-ink">{p}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
