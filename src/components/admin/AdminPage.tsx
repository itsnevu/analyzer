import { clsx } from "@/lib/clsx";

/**
 * The header every admin page starts with: title, one-line description,
 * optional actions on the right, optional tabs underneath. The breadcrumb is
 * in the top bar, so the header does not repeat the section name.
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
  return (
    <div className={clsx("mb-4", className)}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-[1.75rem]">
            {title}
            {count !== undefined && count !== "" && (
              <span className="ml-2 align-middle font-mono text-sm font-medium text-ink-faint">{typeof count === "number" ? count.toLocaleString("en-US") : count}</span>
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
  return (
    <a
      href={href}
      aria-current={active ? "page" : undefined}
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
        active ? "bg-ink text-surface-raised" : "text-ink-muted hover:bg-surface-sunken hover:text-ink",
      )}
    >
      {children}
      {count !== undefined && <span className={clsx("font-mono text-[11px] tabular-nums", active ? "text-surface-raised/70" : "text-ink-faint")}>{count.toLocaleString("en-US")}</span>}
    </a>
  );
}

/** A KPI tile: big number, label, optional delta or note, optional link. */
export function StatTile({ label, value, note, tone, href }: { label: string; value: React.ReactNode; note?: React.ReactNode; tone?: "valid" | "warn" | "hoax" | "brand"; href?: string }) {
  const bar = tone === "valid" ? "bg-verdict-valid" : tone === "warn" ? "bg-verdict-warn" : tone === "hoax" ? "bg-verdict-hoax" : tone === "brand" ? "bg-brand" : "bg-hairline";
  const inner = (
    <>
      <span className={clsx("absolute inset-y-4 left-0 w-1 rounded-r-full", bar)} aria-hidden />
      <div className="text-2xl font-semibold tabular-nums tracking-tight">{value}</div>
      <div className="mt-1 text-xs text-ink-muted">{label}</div>
      {note && <div className="mt-1 text-[11px] text-ink-faint">{note}</div>}
    </>
  );
  const cls = "neu relative block p-4 pl-5";
  return href ? (
    <a href={href} className={clsx(cls, "transition-colors hover:bg-surface-sunken")}>
      {inner}
    </a>
  ) : (
    <div className={cls}>{inner}</div>
  );
}
