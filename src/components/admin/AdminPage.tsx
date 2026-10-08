"use client";

import Link from "next/link";
import { formatAdminNumber } from "@/lib/admin-lang";
import { clsx } from "@/lib/clsx";
import { useAdminT } from "./AdminLang";

/**
 * The header every admin page starts with: title, one-line description,
 * optional actions on the right, optional tabs underneath. The breadcrumb is
 * in the top bar, so the header does not repeat the section name.
 * A client component only to read the panel language for the number format;
 * every prop is plain content, so server pages use it as before.
 */
export function AdminPageHeader({
  title,
  count,
  description,
  actions,
  tabs,
  className,
}: {
  title: React.ReactNode;
  /** a number shown next to the title, e.g. the total rows */
  count?: number | string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  tabs?: React.ReactNode;
  className?: string;
}) {
  const { lang } = useAdminT();
  return (
    <div className={clsx("mb-4", className)}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-[1.75rem]">
            {title}
            {count !== undefined && count !== "" && (
              <span className="ml-2 align-middle font-mono text-sm font-medium text-ink-faint">{typeof count === "number" ? formatAdminNumber(count, lang) : count}</span>
            )}
          </h1>
          {description && <p className="mt-1 max-w-3xl text-sm text-ink-muted">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {tabs && <div className="mt-3 flex flex-wrap gap-1">{tabs}</div>}
    </div>
  );
}

/** A tab-style chip for the header's `tabs` slot; pass `active` for the current one. */
export function AdminTab({ active, children, href, count }: { active: boolean; children: React.ReactNode; href: string; count?: number }) {
  const { lang } = useAdminT();
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
        active ? "bg-ink text-surface-raised" : "text-ink-muted hover:bg-surface-sunken hover:text-ink",
      )}
    >
      {children}
      {count !== undefined && <span className={clsx("font-mono text-[11px] tabular-nums", active ? "text-surface-raised/70" : "text-ink-faint")}>{formatAdminNumber(count, lang)}</span>}
    </Link>
  );
}

/**
 * A KPI tile: big number, label, optional note, optional link.
 * size "lg" is the dashboard's version: a bigger number and a readable label and note.
 */
export function StatTile({
  label,
  value,
  note,
  tone,
  href,
  size = "md",
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  note?: React.ReactNode;
  tone?: "valid" | "warn" | "hoax" | "brand";
  href?: string;
  size?: "md" | "lg";
}) {
  const bar = tone === "valid" ? "bg-verdict-valid" : tone === "warn" ? "bg-verdict-warn" : tone === "hoax" ? "bg-verdict-hoax" : tone === "brand" ? "bg-brand" : "bg-hairline";
  const lg = size === "lg";
  const inner = (
    <>
      <span className={clsx("absolute left-0 w-1 rounded-r-full", lg ? "inset-y-5" : "inset-y-4", bar)} aria-hidden />
      {/* pr-6 keeps a five-digit number clear of the corner arrow on a phone-width card. */}
      <div className={clsx("font-semibold tabular-nums tracking-tight", lg ? "text-[2rem] leading-none sm:text-4xl" : "text-2xl", lg && href && "pr-6")}>{value}</div>
      <div className={clsx(lg ? "mt-2 text-[15px] font-semibold leading-snug text-ink" : "mt-1 text-xs text-ink-muted")}>{label}</div>
      {note && <div className={clsx(lg ? "mt-1 text-sm leading-snug text-ink-muted" : "mt-1 text-[11px] text-ink-faint")}>{note}</div>}
      {href && lg && (
        <span aria-hidden className="absolute right-4 top-4 text-lg text-ink-faint transition-transform group-hover:translate-x-0.5 group-hover:text-ink">
          →
        </span>
      )}
    </>
  );
  const cls = clsx("neu relative block", lg ? "p-5 pl-6" : "p-4 pl-5");
  return href ? (
    <Link href={href} className={clsx(cls, "group transition-colors hover:bg-surface-sunken focus-visible:ring-2 focus-visible:ring-brand/40")}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}
