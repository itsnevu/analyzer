"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { NAV } from "@/lib/dictionary";
import { useI18n } from "@/lib/i18n";
import { LangSwitch } from "@/components/ui/LangSwitch";
import { Logo } from "@/components/ui/Logo";

import { clsx } from "@/lib/clsx";
import { SearchAutocomplete as SearchForm, SearchIcon } from "./SearchAutocomplete";

/**
 * The site header. The full menu sits in the bar from 1024px (lg) up, and has to
 * fit on one line there in both languages: items marked `menuOnly` (Stats) are
 * left out of the bar, and the search box only opens up from 1280px (xl); below
 * that a search button leads to the archive. Smaller screens get the menu button.
 */
export function Navbar() {
  const pathname = usePathname();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  if (pathname.startsWith("/admin")) return null;

  return (
    <header className="sticky top-0 z-50">
      <div className="container-page pt-4">
        <nav className="flex items-center justify-between gap-3 rounded-2xl border border-hairline bg-surface-raised px-4 py-3 shadow-nav sm:px-5">
          <Link href="/" onClick={() => setOpen(false)} className="shrink-0">
            <Logo />
          </Link>

          {/* Desktop links */}
          <ul className="hidden items-center gap-0.5 lg:flex">
            {NAV.filter((l) => !l.menuOnly).map((l) => {
              const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
              return (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    aria-current={active ? "page" : undefined}
                    className={clsx(
                      "whitespace-nowrap rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                      active ? "bg-surface-sunken text-ink shadow-neu-inset-sm" : "text-ink-muted hover:text-ink",
                    )}
                  >
                    {t(l.label)}
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="flex shrink-0 items-center gap-2">
            <SearchForm id="nav-search" className="hidden w-44 xl:block" />
            <Link href="/blog" aria-label={t("Search the fact-check archive")} className="neu-btn hidden h-10 w-10 place-items-center lg:grid xl:hidden">
              <SearchIcon className="h-4 w-4" />
            </Link>
            <LangSwitch className="hidden lg:flex" />
            <button
              aria-label={t("Toggle menu")}
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
              className="neu-btn grid h-10 w-10 place-items-center lg:hidden"
            >
              <span className="flex flex-col gap-1">
                <span className={clsx("h-0.5 w-4 bg-ink transition", open && "translate-y-1.5 rotate-45")} />
                <span className={clsx("h-0.5 w-4 bg-ink transition", open && "opacity-0")} />
                <span className={clsx("h-0.5 w-4 bg-ink transition", open && "-translate-y-1.5 -rotate-45")} />
              </span>
            </button>
          </div>
        </nav>

        {/* Mobile menu: every item, plus language and appearance */}
        {open && (
          <div className="neu-sm mt-2 flex flex-col gap-1 p-2 animate-fade-up lg:hidden">
            <SearchForm id="nav-search-mobile" className="mb-1 px-1 pt-1" onDone={() => setOpen(false)} />
            {NAV.map((l) => {
              const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setOpen(false)}
                  className={clsx(
                    "rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-surface-sunken hover:text-ink",
                    active ? "bg-surface-sunken text-ink" : "text-ink-muted",
                  )}
                >
                  {t(l.label)}
                </Link>
              );
            })}
            <div className="mt-1 flex items-center justify-between border-t border-hairline px-4 pt-3 text-sm font-medium text-ink-muted">
              <span>{t("Language")}</span>
              <LangSwitch />
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
