"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { ReportForm } from "@/components/forms/ReportForm";
import { useI18n } from "@/lib/i18n";

export default function ReportPage() {
  const { t } = useI18n();
  return (
    <>
      <PageHeader eyebrowKey="report.eyebrow" titleKey="report.title" introKey="report.intro" />
      <section className="container-page pb-8">
        <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-[1fr_1.7fr]">
          <div className="space-y-4">
            <div className="neu p-6">
              <h2 className="font-display font-bold">Before you report</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                It may already have been fact-checked. Paste it into the{" "}
                <Link href="/detector" className="text-brand-to hover:underline">
                  detector
                </Link>{" "}
                or search the{" "}
                <Link href="/blog" className="text-brand-to hover:underline">
                  archive
                </Link>{" "}
                first.
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
              {t("report.general")}{" "}
              <Link href="/contact" className="text-brand-to hover:underline">
                contact form
              </Link>
              .
            </div>
          </div>
          <ReportForm />
        </div>
      </section>
    </>
  );
}
