"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { ContactForm } from "@/components/forms/ContactForm";
import { useI18n } from "@/lib/i18n";

export default function ContactPage() {
  const { t } = useI18n();
  return (
    <>
      <PageHeader eyebrowKey="contact.eyebrow" titleKey="contact.title" introKey="contact.intro" />
      <section className="container-page pb-8">
        <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-[1fr_1.4fr]">
          <div className="space-y-4">
            <div className="neu hidden overflow-hidden p-0 md:block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/pages/connect.jpg?v=2" alt="" className="aspect-[16/10] w-full object-cover" />
            </div>
            <div className="neu p-6">
              <div className="eyebrow">{t("contact.emailLabel")}</div>
              <a
                href="mailto:syyhoaxanalyzer@gmail.com"
                className="mt-3 block text-sm font-medium text-ink transition-colors hover:text-brand-to"
              >
                syyhoaxanalyzer@gmail.com
              </a>
            </div>
            <div className="neu p-6">
              <div className="eyebrow">{t("contact.researchLabel")}</div>
              <p className="mt-3 text-sm text-ink-muted">{t("contact.researchBody")}</p>
            </div>
            <div className="neu-inset p-6 text-sm text-ink-muted">
              Want to report a hoax or a wrong result? Use the{" "}
              <Link href="/report" className="text-brand-to hover:underline">
                report form
              </Link>
              ; it gives you a report number.
            </div>
          </div>
          <ContactForm />
        </div>
      </section>
    </>
  );
}
