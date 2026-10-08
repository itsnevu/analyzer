"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useI18n } from "@/lib/i18n";

/** Shown when a page fails to render; the rest of the site keeps working. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="container-page grid min-h-[60vh] place-items-center py-20 text-center">
      <div className="max-w-md">
        <div className="font-display text-5xl font-bold gradient-text">{t("Oops")}</div>
        <h1 className="mt-4 font-display text-2xl font-bold">{t("Something went wrong on this page")}</h1>
        <p className="mt-2 text-ink-muted">
          {error.digest
            ? t("It is not you. Try again, and if it keeps happening, let us know and mention the code {code}.", { code: error.digest })
            : t("It is not you. Try again, and if it keeps happening, let us know.")}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button onClick={reset} className="btn-primary px-6 py-3 text-sm">
            {t("Try again")}
          </button>
          <Link href="/" className="neu-btn px-6 py-3 text-sm">
            {t("Back to Home")}
          </Link>
          <Link href="/contact" className="neu-btn px-6 py-3 text-sm">
            {t("Contact us")}
          </Link>
        </div>
      </div>
    </section>
  );
}
