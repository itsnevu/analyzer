"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { NAV } from "@/lib/dictionary";
import { useI18n } from "@/lib/i18n";
import { Logo } from "@/components/ui/Logo";
import { clsx } from "@/lib/clsx";

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { lang, t } = useI18n();
  const links = NAV[lang];

  if (pathname.startsWith("/admin")) return null;

  return (
    <header className="sticky top-0 z-50">
      <div className="container-page pt-4">
        <nav className="flex items-center justify-between gap-4 rounded-2xl border border-hairline bg-surface-raised px-4 py-3 sm:px-5 shadow-[0_14px_34px_-14px_rgba(25,24,23,0.38)]">
          {/* Logo */}
          <Link href="/" onClick={() => setOpen(false)}>
            <Logo />
          </Link>

          {/* Desktop links */}
          <ul className="hidden items-center gap-1 md:flex">
            {links.map((l) => {
              const active =
                l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
              return (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className={clsx(
                      "rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
                      active
                        ? "text-ink shadow-neu-inset-sm bg-surface-sunken"
                        : "text-ink-muted hover:text-ink",
                    )}
                  >
                    {l.label}
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="flex items-center gap-2">
            <Link href="/detector" className="btn-primary hidden px-4 py-2 text-sm sm:inline-flex">
              {t("nav.cta")}
            </Link>
            <button
              aria-label="Toggle menu"
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
          <div className="neu-sm mt-2 flex flex-col gap-1 p-2 md:hidden animate-fade-up">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-4 py-2.5 text-sm font-medium text-ink-muted hover:bg-surface-sunken hover:text-ink"
              >
                {l.label}
              </Link>
            ))}
            <Link href="/detector" onClick={() => setOpen(false)} className="btn-primary mt-1 px-4 py-2.5 text-sm">
              {t("nav.cta")}
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
