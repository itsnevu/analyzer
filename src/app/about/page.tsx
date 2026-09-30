"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { useI18n } from "@/lib/i18n";

export default function AboutPage() {
  const { t } = useI18n();
  const approaches = [
    { title: t("about.a1.title"), body: t("about.a1.body") },
    { title: t("about.a2.title"), body: t("about.a2.body") },
    { title: t("about.a3.title"), body: t("about.a3.body") },
  ];

  return (
    <>
      <PageHeader
        eyebrowKey="about.eyebrow"
        titleKey="about.title.a"
        highlightKey="about.title.b"
        introKey="about.intro"
        image="/pages/about.jpg?v=2"
      />
      <section className="container-page pb-8">
        <div className="mx-auto max-w-4xl">
          <div className="grid gap-4 sm:grid-cols-3">
            {approaches.map((a) => (
              <div key={a.title} className="neu p-6">
                <h3 className="font-display font-bold">{a.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">{a.body}</p>
              </div>
            ))}
          </div>

          <div className="neu mt-6 p-8">
            <div className="eyebrow">{t("about.research.eyebrow")}</div>
            <h2 className="mt-3 font-display text-2xl font-bold">{t("about.research.title")}</h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted">{t("about.research.body")}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/detector" className="btn-primary px-6 py-3 text-sm">{t("about.tryDetector")}</Link>
              <a
                href="https://rag-fusion.streamlit.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="neu-btn px-6 py-3 text-sm font-medium"
              >
                RAG Fusion (Streamlit) ↗
              </a>
            </div>
          </div>

          <div className="neu-inset mt-6 flex flex-col items-start justify-between gap-3 p-6 text-sm sm:flex-row sm:items-center">
            <span className="text-ink-muted">{t("about.contactLine")}</span>
            <a href="mailto:syyhoaxanalyzer@gmail.com" className="font-medium text-brand-to hover:underline">
              syyhoaxanalyzer@gmail.com
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
