"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogoMark } from "@/components/ui/Logo";
import { clsx } from "@/lib/clsx";

const LINKS = [
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/articles", label: "Articles", exact: false },
  { href: "/admin/reports", label: "Reports", exact: false },
];

export function AdminSidebar({ unreadReports = 0 }: { unreadReports?: number }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <aside className="flex flex-col gap-1 md:sticky md:top-4 md:h-[calc(100vh-2rem)]">
      <div className="neu mb-2 flex items-center gap-2.5 p-4">
        <LogoMark className="h-8 w-8" />
        <div className="leading-tight">
          <div className="font-display text-sm font-bold">Admin Panel</div>
          <div className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">Hoax Analyzer</div>
        </div>
      </div>

      <nav className="neu flex flex-col gap-1 p-2">
        {LINKS.map((l) => {
          const active = l.exact ? pathname === l.href : pathname.startsWith(l.href);
          const badge = l.href === "/admin/reports" && unreadReports > 0 ? unreadReports : 0;
          return (
            <Link
              key={l.href}
              href={l.href}
              className={clsx(
                "flex items-center justify-between rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors",
                active ? "bg-ink text-surface-raised" : "text-ink-muted hover:bg-surface-sunken hover:text-ink",
              )}
            >
              {l.label}
              {badge > 0 && (
                <span
                  className="rounded-full bg-verdict-hoax px-2 py-0.5 text-[11px] font-semibold text-white"
                  aria-label={`${badge} unread`}
                >
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-1 pt-2">
        <Link href="/" className="neu-btn px-3.5 py-2.5 text-sm font-medium">
          ← View site
        </Link>
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
