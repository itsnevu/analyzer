"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/ui/Logo";
import { useI18n } from "@/lib/i18n";

export function Footer() {
  const { t } = useI18n();
  const pathname = usePathname();
  if (pathname.startsWith("/admin")) return null;

  const cols = [
    {
      title: t("footer.col.product"),
      links: [
        { label: t("footer.link.detector"), href: "/detector" },
        { label: t("footer.link.blog"), href: "/blog" },
        { label: "Statistics", href: "/stats" },
        { label: t("footer.link.report"), href: "/report" },
        { label: t("footer.link.disclaimer"), href: "/disclaimer" },
        { label: "Privacy", href: "/privacy" },
        { label: "RSS feed", href: "/feed.xml" },
      ],
    },
    {
      title: t("footer.col.research"),
      links: [
        { label: t("footer.link.about"), href: "/about" },
        { label: t("footer.link.method"), href: "/#how" },
      ],
    },
    {
      title: t("footer.col.contact"),
      links: [
        { label: t("footer.link.contact"), href: "/contact" },
        { label: "syyhoaxanalyzer@gmail.com", href: "mailto:syyhoaxanalyzer@gmail.com" },
      ],
    },
  ];

  return (
    <footer className="mt-24 pb-10">
      <div className="container-page">
        <div className="neu grid gap-10 p-8 sm:p-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink-muted">
              {t("footer.tagline")}
            </p>
          </div>

          {cols.map((col) => (
            <div key={col.title}>
              <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-faint">
                {col.title}
              </h4>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    {/* Files and other sites are plain links; the router only handles pages. */}
                    {/^(https?:|mailto:)|\.xml$/.test(l.href) ? (
                      <a href={l.href} className="text-sm text-ink-muted transition-colors hover:text-ink">
                        {l.label}
                      </a>
                    ) : (
                      <Link href={l.href} className="text-sm text-ink-muted transition-colors hover:text-ink">
                        {l.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-col items-center justify-between gap-3 px-2 text-xs text-ink-faint sm:flex-row">
          <p>© {new Date().getFullYear()} Hoax Detection &amp; Analyzer. {t("footer.rights")}</p>
        </div>
      </div>
    </footer>
  );
}
