import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { ContactForm } from "@/components/forms/ContactForm";
import { getSiteT } from "@/lib/site-lang-server";
import { rich } from "@/components/ui/Rich";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getSiteT();
  return { title: t("contact.eyebrow") };
}

export default async function ContactPage() {
  const { t } = await getSiteT();
  return (
    <>
      <PageHeader eyebrowKey="contact.eyebrow" titleKey="contact.title" introKey="contact.intro" />
      <section className="container-page pb-8">
        <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-[1fr_1.4fr]">
          <div className="space-y-4">
            <div className="hidden md:block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/pages/chat-envelope-transparent.webp" alt="" width={1536} height={1024} className="aspect-[16/10] w-full object-contain" />
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
              {rich(t("Want to report a hoax or a wrong result? Use the <link>report form</link>; it gives you a report number."), {
                link: (s) => (
                  <Link href="/report" className="text-brand-to hover:underline">
                    {s}
                  </Link>
                ),
              })}
            </div>
          </div>
          <ContactForm />
        </div>
      </section>
    </>
  );
}
