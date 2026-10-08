"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoMark } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { clsx } from "@/lib/clsx";
import { ADMIN_NAV, findAdminLink } from "./admin-nav";
import { AdminIcon } from "./AdminIcons";
import { useAdminT } from "./AdminLang";

export interface AdminBadges {
  reports: number;
  review: number;
  attention: number;
}

/**
 * The dark side rail of the admin shell. Expanded it shows group titles and
 * labels; collapsed (desktop only) it keeps the icons with a tooltip. On
 * phones it slides in as a drawer (AdminShell owns that state).
 */
export function AdminSidebar({
  badges,
  collapsed,
  onNavigate,
  onLogout,
}: {
  badges: AdminBadges;
  collapsed: boolean;
  onNavigate?: () => void;
  onLogout: () => void;
}) {
  const pathname = usePathname();
  const current = findAdminLink(pathname)?.link.href;
  const { t } = useAdminT();

  return (
    <div className="flex h-full flex-col text-[var(--sidebar-ink)]">
      <Link href="/admin" onClick={onNavigate} className={clsx("flex items-center gap-3 px-4", collapsed ? "h-16 justify-center" : "h-16")}>
        <LogoMark className="h-8 w-8 shrink-0" />
        {!collapsed && (
          <span className="leading-tight">
            <span className="block font-display text-sm font-bold">Hoax Analyzer</span>
            <span className="block font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--sidebar-muted)]">{t("Control panel")}</span>
          </span>
        )}
      </Link>

      <nav className="flex-1 overflow-y-auto px-2 pb-3" aria-label={t("Admin")}>
        {ADMIN_NAV.map((group) => (
          <div key={group.title} className="mt-3 first:mt-1">
            {collapsed ? (
              <div className="mx-3 my-2 border-t border-[var(--sidebar-line)]" aria-hidden />
            ) : (
              <div className="px-3 pb-1.5 pt-2 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--sidebar-muted)]">{t(group.title)}</div>
            )}
            <ul className="space-y-0.5">
              {group.links.map((l) => {
                const active = current === l.href;
                const badge = l.badge ? badges[l.badge] : 0;
                return (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      onClick={onNavigate}
                      title={collapsed ? `${t(l.label)}: ${t(l.hint)}` : t(l.hint)}
                      aria-current={active ? "page" : undefined}
                      className={clsx(
                        "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        collapsed && "justify-center px-0",
                        active ? "bg-[var(--sidebar-active)] text-white" : "text-[var(--sidebar-ink)]/85 hover:bg-[var(--sidebar-hover)] hover:text-white",
                      )}
                    >
                      {active && <span className="absolute -left-2 top-1.5 h-[calc(100%-12px)] w-0.5 rounded-full bg-brand" aria-hidden />}
                      <AdminIcon name={l.icon} className={clsx("h-[18px] w-[18px] shrink-0", active ? "text-brand" : "text-[var(--sidebar-muted)] group-hover:text-white")} />
                      {!collapsed && <span className="min-w-0 flex-1 truncate">{t(l.label)}</span>}
                      {badge > 0 && (
                        <span
                          className={clsx(
                            "rounded-full px-1.5 py-px text-[10px] font-semibold tabular-nums text-white",
                            l.badge === "reports" ? "bg-verdict-hoax" : "bg-verdict-warn",
                            collapsed && "absolute right-1 top-0.5",
                          )}
                          aria-label={l.badge === "reports" ? t("{n} unread", { n: badge }) : t("{n} waiting", { n: badge })}
                        >
                          {badge > 99 ? "99+" : badge}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className={clsx("border-t border-[var(--sidebar-line)] p-3", collapsed && "px-2")}>
        <div className={clsx("flex items-center gap-3", collapsed && "flex-col")}>
          <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--sidebar-hover)] font-display text-sm font-bold" aria-hidden>
            A
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[var(--sidebar-bg)] bg-verdict-valid" />
          </span>
          {!collapsed && (
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-sm font-semibold">{t("Admin")}</span>
              <span className="block text-[11px] text-[var(--sidebar-muted)]">{t("Online")}</span>
            </span>
          )}
          <ThemeToggle className="shrink-0 border-[var(--sidebar-line)] text-[var(--sidebar-ink)] hover:bg-[var(--sidebar-hover)]" />
        </div>
        <div className={clsx("mt-3 flex gap-2", collapsed && "flex-col")}>
          <Link
            href="/"
            title={t("View site")}
            className={clsx("flex items-center justify-center gap-1.5 rounded-lg border border-[var(--sidebar-line)] px-3 py-2 text-xs font-medium hover:bg-[var(--sidebar-hover)]", !collapsed && "flex-1")}
          >
            <AdminIcon name="globe" className="h-4 w-4" />
            {!collapsed && t("View site")}
          </Link>
          <button
            type="button"
            onClick={onLogout}
            title={t("Log out")}
            className={clsx("flex items-center justify-center gap-1.5 rounded-lg border border-[var(--sidebar-line)] px-3 py-2 text-xs font-medium text-verdict-hoax hover:bg-verdict-hoax/15", !collapsed && "flex-1")}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M15 8l5 4-5 4M20 12H9" />
            </svg>
            {!collapsed && t("Log out")}
          </button>
        </div>
      </div>
    </div>
  );
}
