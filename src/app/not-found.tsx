import Link from "next/link";

export default function NotFound() {
  return (
    <section className="container-page grid min-h-[60vh] place-items-center py-20 text-center">
      <div>
        <div className="font-display text-7xl font-bold gradient-text">404</div>
        <h1 className="mt-4 font-display text-2xl font-bold">Page not found</h1>
        <p className="mt-2 text-ink-muted">It may have been moved, or the link is wrong.</p>
        <Link href="/" className="btn-primary mt-8 inline-flex px-6 py-3 text-sm">
          Back to Home
        </Link>
      </div>
    </section>
  );
}
