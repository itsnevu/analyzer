import type { Metadata } from "next";
import Link from "next/link";
import { getSiteT } from "@/lib/site-lang-server";

// Rendered per request in the visitor's language; the service worker keeps a copy (public/sw.js).
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getSiteT();
  return { title: t("Offline"), robots: { index: false } };
}

/** Shown by the service worker (public/sw.js) when a page cannot load. */
export default async function OfflinePage() {
  const { t } = await getSiteT();
  return (
    <section className="container-page grid min-h-[60vh] place-items-center py-20 text-center">
      <div className="max-w-md">
        <div className="font-display text-5xl font-bold gradient-text">{t("Offline")}</div>
        <h1 className="mt-4 font-display text-2xl font-bold">{t("No connection right now")}</h1>
        <p className="mt-2 text-ink-muted">
          {t("Checking a message needs the internet, because it is compared with our fact-check archive. Try again once you are back online.")}
        </p>
        <Link href="/detector" className="btn-primary mt-8 inline-flex px-6 py-3 text-sm">
          {t("Try again")}
        </Link>
      </div>
    </section>
  );
}
