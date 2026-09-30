"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import { ContactForm } from "@/components/forms/ContactForm";
import { useI18n } from "@/lib/i18n";

export default function ReportPage() {
  const { t } = useI18n();
  return (
    <>
      <PageHeader eyebrowKey="report.eyebrow" titleKey="report.title" introKey="report.intro" />
      <section className="container-page pb-8">
        <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-[1fr_1.4fr]">
          <div className="space-y-4">
            <div className="neu overflow-hidden p-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/pages/connect.jpg?v=2" alt="" className="aspect-[16/10] w-full object-cover" />
            </div>
            <div className="neu p-6">
              <h3 className="font-display font-bold">{t("report.after")}</h3>
              <ul className="mt-4 space-y-3 text-sm text-ink-muted">
                <li className="flex gap-2"><span className="text-brand-to">1.</span> {t("report.step1")}</li>
                <li className="flex gap-2"><span className="text-brand-to">2.</span> {t("report.step2")}</li>
                <li className="flex gap-2"><span className="text-brand-to">3.</span> {t("report.step3")}</li>
              </ul>
            </div>
            <div className="neu-inset p-6 text-sm text-ink-muted">
              {t("report.general")}{" "}
              <a href="/contact" className="text-brand-to hover:underline">Contact Us</a>.
            </div>
          </div>
          <ContactForm variant="report" />
        </div>
      </section>
    </>
  );
}
