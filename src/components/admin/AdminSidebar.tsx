"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogoMark } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { clsx } from "@/lib/clsx";

/** Grouped like the legacy panel's menu (DATA HOAX, HOAX SETTING, …), with the new site's names. */
const GROUPS: { title: string; links: { href: string; label: string; exact?: boolean; badge?: "reports" | "review" }[] }[] = [
  {
    title: "Overview",
    links: [{ href: "/admin", label: "Dashboard", exact: true }],
  },
  {
    title: "Detector",
    links: [
      { href: "/admin/detect", label: "Detection lab" },
      { href: "/admin/model", label: "Model" },
      { href: "/admin/searches", label: "Searches" },
    ],
  },
  {
    title: "Content",
    links: [
      { href: "/admin/articles", label: "Articles" },
      { href: "/admin/review", label: "Review queue", badge: "review" },
      { href: "/admin/extract", label: "Extract from a page" },
      { href: "/admin/reports", label: "Reports", badge: "reports" },
    ],
  },
  {
    title: "Data",
    links: [
      { href: "/admin/dataset", label: "Dataset" },
      { href: "/admin/sources", label: "Sources" },
      { href: "/admin/research", label: "Research log" },
    ],
  },
  {
    title: "Settings",
    links: [{ href: "/admin/settings", label: "Settings" }],
  },
];

export function AdminSidebar({ unreadReports = 0, pendingReview = 0 }: { unreadReports?: number; pendingReview?: number }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  const badges = { reports: unreadReports, review: pendingReview };

  return (
    <aside className="flex flex-col gap-1 md:sticky md:top-4 md:max-h-[calc(100vh-2rem)]">
      <div className="neu mb-2 flex items-center gap-2.5 p-4">
        <LogoMark className="h-8 w-8" />
        <div className="leading-tight">
          <div className="font-display text-sm font-bold">Admin Panel</div>
          <div className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">Hoax Analyzer</div>
        </div>
      </div>

      <nav className="neu flex flex-col gap-3 overflow-y-auto p-2">
        {GROUPS.map((g) => (
          <div key={g.title}>
            <div className="px-3.5 pb-1 pt-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-faint">{g.title}</div>
            <div className="flex flex-col gap-0.5">
              {g.links.map((l) => {
                const active = l.exact ? pathname === l.href : pathname.startsWith(l.href);
                const badge = l.badge ? badges[l.badge] : 0;
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    className={clsx(
                      "flex items-center justify-between rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
                      active ? "bg-ink text-surface-raised" : "text-ink-muted hover:bg-surface-sunken hover:text-ink",
                    )}
                  >
                    {l.label}
                    {badge > 0 && (
                      <span
                        className={clsx(
                          "rounded-full px-2 py-0.5 text-[11px] font-semibold text-white",
                          l.badge === "reports" ? "bg-verdict-hoax" : "bg-verdict-warn",
                        )}
                        aria-label={`${badge} ${l.badge === "reports" ? "unread" : "waiting"}`}
                      >
                        {badge > 99 ? "99+" : badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-1 pt-2">
        <div className="flex items-center gap-2">
          <Link href="/" className="neu-btn flex-1 px-3.5 py-2.5 text-sm font-medium">
            ← View site
          </Link>
          <ThemeToggle />
        </div>
        <button
          onClick={logout}
          className="rounded-full border border-hairline px-3.5 py-2.5 text-sm font-medium text-verdict-hoax transition-colors hover:bg-verdict-hoax/10"
        >
          Log out
        </button>
      </div>
    </aside>
  );
}
