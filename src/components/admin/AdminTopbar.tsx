"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "@/lib/clsx";
import { adminBreadcrumb } from "./admin-nav";

/** Sticky bar above the content: menu toggle, breadcrumb, quick search, link to the site. */
export function AdminTopbar({
  collapsed,
  onToggleSidebar,
  onOpenDrawer,
  onOpenPalette,
}: {
  collapsed: boolean;
  onToggleSidebar: () => void;
  onOpenDrawer: () => void;
  onOpenPalette: () => void;
}) {
  const pathname = usePathname();
  const crumbs = adminBreadcrumb(pathname);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-hairline bg-surface-raised/85 px-3 backdrop-blur sm:px-5">
      <button type="button" onClick={onOpenDrawer} aria-label="Open menu" className="neu-btn grid h-9 w-9 place-items-center md:hidden">
        <MenuIcon />
      </button>
      <button
        type="button"
        onClick={onToggleSidebar}
        aria-label={collapsed ? "Expand the menu" : "Collapse the menu"}
        aria-pressed={collapsed}
        className="neu-btn hidden h-9 w-9 place-items-center md:grid"
      >
        <MenuIcon />
      </button>

      <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
        <ol className="flex items-center gap-1.5 truncate text-sm">
          {crumbs.map((c, i) => {
            const last = i === crumbs.length - 1;
            return (
              <li key={`${c.label}-${i}`} className="flex min-w-0 items-center gap-1.5">
                {i > 0 && <span className="text-ink-faint" aria-hidden>›</span>}
                {c.href && !last ? (
                  <Link href={c.href} className="truncate text-ink-muted hover:text-ink">
                    {c.label}
                  </Link>
                ) : (
                  <span className={clsx("truncate", last ? "font-semibold text-ink" : "text-ink-muted")} aria-current={last ? "page" : undefined}>
                    {c.label}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      <button
        type="button"
        onClick={onOpenPalette}
        className="flex h-9 items-center gap-2 rounded-full border border-hairline bg-surface-sunken px-3 text-sm text-ink-muted transition-colors hover:border-ink hover:text-ink"
        aria-label="Search the panel (Ctrl+K)"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" strokeLinecap="round" />
        </svg>
        <span className="hidden sm:inline">Search…</span>
        <kbd className="hidden rounded border border-hairline px-1.5 font-mono text-[10px] text-ink-faint sm:inline">Ctrl K</kbd>
      </button>
      <Link href="/" target="_blank" className="neu-btn hidden h-9 items-center gap-1.5 px-3 text-sm md:flex">
        View site <span aria-hidden>↗</span>
      </Link>
    </header>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}
