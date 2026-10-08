import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { DISCLAIMER_POINTS } from "@/lib/dictionary";
import { getSiteT } from "@/lib/site-lang-server";
import { rich } from "@/components/ui/Rich";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getSiteT();
  return { title: t("disclaimer.eyebrow") };
}

export default async function DisclaimerPage() {
  const { t } = await getSiteT();
  return (
    <>
      <PageHeader eyebrowKey="disclaimer.eyebrow" titleKey="disclaimer.title" introKey="disclaimer.intro" />
      <section className="container-page pb-8">
        <div className="mx-auto max-w-3xl space-y-3">
          {DISCLAIMER_POINTS.map((p, i) => (
            <div key={i} className="neu flex gap-4 p-5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-brand-gradient text-sm font-bold text-surface">
                {i + 1}
              </span>
              <p className="text-sm leading-relaxed text-ink">{t(p)}</p>
            </div>
          ))}
          <p className="pt-3 text-xs text-ink-faint">
            {rich(t("Last updated October 1, 2026. Questions: <mail>syyhoaxanalyzer@gmail.com</mail>"), {
              mail: (s) => (
                <a href="mailto:syyhoaxanalyzer@gmail.com" className="underline hover:text-ink">
                  {s}
                </a>
              ),
            })}
          </p>
        </div>
      </section>
    </>
  );
}
