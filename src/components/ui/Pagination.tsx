import Link from "next/link";
import { clsx } from "@/lib/clsx";

/** Page links for a server-rendered list. `hrefFor` builds the URL for a page number. */
export function Pagination({
  page,
  pages,
  hrefFor,
}: {
  page: number;
  pages: number;
  hrefFor: (page: number) => string;
}) {
  if (pages <= 1) return null;

  // Current page, its neighbours, and the ends; gaps become "…".
  const wanted = new Set([1, pages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pages));
  const items: (number | "gap")[] = [];
  for (let p = 1; p <= pages; p++) {
    if (wanted.has(p)) items.push(p);
    else if (items[items.length - 1] !== "gap") items.push("gap");
  }

  const pill = "grid h-9 min-w-9 place-items-center rounded-full px-3 text-sm font-medium transition-colors";
  return (
    <nav aria-label="Pages" className="mt-8 flex flex-wrap items-center justify-center gap-1.5">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={clsx(pill, "neu-btn")} rel="prev">
          ← Prev
        </Link>
      ) : (
        <span className={clsx(pill, "text-ink-faint")}>← Prev</span>
      )}
      {items.map((item, i) =>
        item === "gap" ? (
          <span key={`gap-${i}`} className="px-1 text-ink-faint">
            …
          </span>
        ) : (
          <Link
            key={item}
            href={hrefFor(item)}
            aria-current={item === page ? "page" : undefined}
            className={clsx(pill, item === page ? "bg-ink text-surface-raised" : "text-ink-muted hover:bg-surface-sunken hover:text-ink")}
          >
            {item}
          </Link>
        ),
      )}
      {page < pages ? (
        <Link href={hrefFor(page + 1)} className={clsx(pill, "neu-btn")} rel="next">
          Next →
        </Link>
      ) : (
        <span className={clsx(pill, "text-ink-faint")}>Next →</span>
      )}
    </nav>
  );
}
