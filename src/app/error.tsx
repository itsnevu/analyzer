"use client";

import Link from "next/link";
import { useEffect } from "react";

/** Shown when a page fails to render; the rest of the site keeps working. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="container-page grid min-h-[60vh] place-items-center py-20 text-center">
      <div className="max-w-md">
        <div className="font-display text-5xl font-bold gradient-text">Oops</div>
        <h1 className="mt-4 font-display text-2xl font-bold">Something went wrong on this page</h1>
        <p className="mt-2 text-ink-muted">
          It is not you. Try again, and if it keeps happening, let us know
          {error.digest ? ` and mention the code ${error.digest}` : ""}.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button onClick={reset} className="btn-primary px-6 py-3 text-sm">
            Try again
          </button>
          <Link href="/" className="neu-btn px-6 py-3 text-sm">
            Back to Home
          </Link>
          <Link href="/contact" className="neu-btn px-6 py-3 text-sm">
            Contact us
          </Link>
        </div>
      </div>
    </section>
  );
}
