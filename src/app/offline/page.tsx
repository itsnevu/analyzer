import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Offline",
  robots: { index: false },
};

/** Shown by the service worker (public/sw.js) when a page cannot load. */
export default function OfflinePage() {
  return (
    <section className="container-page grid min-h-[60vh] place-items-center py-20 text-center">
      <div className="max-w-md">
        <div className="font-display text-5xl font-bold gradient-text">Offline</div>
        <h1 className="mt-4 font-display text-2xl font-bold">No connection right now</h1>
        <p className="mt-2 text-ink-muted">
          Checking a message needs the internet, because it is compared with our fact-check archive. Try again once you are back online.
        </p>
        <Link href="/detector" className="btn-primary mt-8 inline-flex px-6 py-3 text-sm">
          Try again
        </Link>
      </div>
    </section>
  );
}
