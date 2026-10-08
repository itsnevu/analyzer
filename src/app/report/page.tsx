import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { ReportForm } from "@/components/forms/ReportForm";
import { getSiteT } from "@/lib/site-lang-server";
import { rich } from "@/components/ui/Rich";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getSiteT();
  return { title: t("report.eyebrow") };
}

export default async function ReportPage() {
  const { t } = await getSiteT();
  return (
    <>
      <PageHeader eyebrowKey="report.eyebrow" titleKey="report.title" introKey="report.intro" />
      <section className="container-page pb-8">
        <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-[1fr_1.7fr]">
          <div className="space-y-4">
            <div className="neu p-6">
              <h2 className="font-display font-bold">{t("Before you report")}</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                {rich(t("It may already have been fact-checked. Paste it into the <detector>detector</detector> or search the <archive>archive</archive> first."), {
                  detector: (s) => (
                    <Link href="/detector" className="text-brand-to hover:underline">
                      {s}
                    </Link>
                  ),
                  archive: (s) => (
                    <Link href="/blog" className="text-brand-to hover:underline">
                      {s}
                    </Link>
                  ),
                })}
              </p>
            </div>
            <div className="neu p-6">
              <h2 className="font-display font-bold">{t("report.after")}</h2>
              <ol className="mt-4 space-y-3 text-sm text-ink-muted">
                <li className="flex gap-2"><span className="text-brand-to">1.</span> {t("report.step1")}</li>
                <li className="flex gap-2"><span className="text-brand-to">2.</span> {t("report.step2")}</li>
                <li className="flex gap-2"><span className="text-brand-to">3.</span> {t("report.step3")}</li>
              </ol>
            </div>
            <div className="neu-inset p-6 text-sm text-ink-muted">
              {rich(t("report.general"), {
                link: (s) => (
                  <Link href="/contact" className="text-brand-to hover:underline">
                    {s}
                  </Link>
                ),
              })}
            </div>
          </div>
          <ReportForm />
        </div>
      </section>
    </>
  );
}
