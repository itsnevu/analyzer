"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { NAV } from "@/lib/dictionary";
import { Logo } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { clsx } from "@/lib/clsx";
import { SearchAutocomplete as SearchForm, SearchIcon } from "./SearchAutocomplete";

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  if (pathname.startsWith("/admin")) return null;

  return (
    <header className="sticky top-0 z-50">
      <div className="container-page pt-4">
        <nav className="flex items-center justify-between gap-4 rounded-2xl border border-hairline bg-surface-raised px-4 py-3 shadow-nav sm:px-5">
          <Link href="/" onClick={() => setOpen(false)} className="shrink-0">
            <Logo />
          </Link>

          {/* Desktop links */}
          <ul className="hidden items-center gap-1 md:flex">
            {NAV.map((l) => {
              const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
              return (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    aria-current={active ? "page" : undefined}
                    className={clsx(
                      "rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
                      active ? "bg-surface-sunken text-ink shadow-neu-inset-sm" : "text-ink-muted hover:text-ink",
                    )}
                  >
                    {l.label}
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="flex items-center gap-2">
            <SearchForm id="nav-search" className="hidden w-52 lg:block" />
            <Link href="/blog" aria-label="Search the fact-check archive" className="neu-btn hidden h-10 w-10 place-items-center md:grid lg:hidden">
              <SearchIcon className="h-4 w-4" />
            </Link>
            <ThemeToggle className="hidden md:grid" />
            <button
              aria-label="Toggle menu"
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
              className="neu-btn grid h-10 w-10 place-items-center md:hidden"
            >
              <span className="flex flex-col gap-1">
                <span className={clsx("h-0.5 w-4 bg-ink transition", open && "translate-y-1.5 rotate-45")} />
                <span className={clsx("h-0.5 w-4 bg-ink transition", open && "opacity-0")} />
                <span className={clsx("h-0.5 w-4 bg-ink transition", open && "-translate-y-1.5 -rotate-45")} />
              </span>
            </button>
          </div>
        </nav>

        {/* Mobile menu */}
        {open && (
          <div className="neu-sm mt-2 flex flex-col gap-1 p-2 animate-fade-up md:hidden">
            <SearchForm id="nav-search-mobile" className="mb-1 px-1 pt-1" onDone={() => setOpen(false)} />
            {NAV.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-4 py-2.5 text-sm font-medium text-ink-muted hover:bg-surface-sunken hover:text-ink"
              >
                {l.label}
              </Link>
            ))}
            <div className="mt-1 flex items-center justify-between border-t border-hairline px-4 pt-3 pb-1 text-sm font-medium text-ink-muted">
              <span>Appearance</span>
              <ThemeToggle />
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
