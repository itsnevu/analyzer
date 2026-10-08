"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { clsx } from "@/lib/clsx";
import { isTypingTarget, matchSequence, type SequenceState } from "@/lib/shortcuts";
import { AdminSidebar, type AdminBadges } from "./AdminSidebar";
import { AdminTopbar } from "./AdminTopbar";
import { CommandPalette } from "./CommandPalette";
import { ShortcutsDialog } from "./ShortcutsDialog";
import { ToastProvider } from "./Toast";

const COLLAPSED_KEY = "admin.sidebar.collapsed";
const COLLAPSED_EVENT = "admin-sidebar";

// The collapsed state lives in localStorage; useSyncExternalStore reads it without a hydration mismatch
// (the server renders it expanded and the browser catches up).
function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}
function writeCollapsed(value: boolean): void {
  try {
    localStorage.setItem(COLLAPSED_KEY, value ? "1" : "0");
  } catch {
    /* private mode */
  }
  window.dispatchEvent(new Event(COLLAPSED_EVENT));
}
function subscribeCollapsed(cb: () => void): () => void {
  window.addEventListener(COLLAPSED_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(COLLAPSED_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/**
 * The admin app shell: a fixed side rail (drawer on phones), a sticky top bar
 * with breadcrumb and quick search, and the page content. The collapsed state
 * is remembered per browser. Also owns the panel-wide keyboard shortcuts
 * (Ctrl+K, "?", "g" then a letter) and the toast notices.
 */
export function AdminShell({ badges, children }: { badges: AdminBadges; children: React.ReactNode }) {
  const router = useRouter();
  const collapsed = useSyncExternalStore(subscribeCollapsed, readCollapsed, () => false);
  const [drawer, setDrawer] = useState(false);
  const [palette, setPalette] = useState(false);
  const [shortcuts, setShortcuts] = useState(false);
  // When "g" was pressed, for the "g then a letter" jumps.
  const sequence = useRef<SequenceState>(null);

  const toggleCollapsed = () => writeCollapsed(!collapsed);
  const closePalette = useCallback(() => setPalette(false), []);
  const closeShortcuts = useCallback(() => setShortcuts(false), []);
  const openShortcuts = useCallback(() => {
    setPalette(false);
    setShortcuts(true);
  }, []);

  // Ctrl/Cmd+K opens the palette; Escape closes the drawer; "?" lists the shortcuts; "g d", "g a"… jump.
  // Registered in the capture phase so a completed "g" jump is not also seen by a page's own keys
  // (the review queue acts on "d" and "s").
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setShortcuts(false);
        setPalette((p) => !p);
        return;
      }
      if (e.key === "Escape") {
        setDrawer(false);
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || isTypingTarget(e.target as HTMLElement | null)) return;
      if (e.key === "?") {
        e.preventDefault();
        setPalette(false);
        setShortcuts((s) => !s);
        return;
      }
      const result = matchSequence(sequence.current, e.key, Date.now());
      sequence.current = result.state;
      if (!result.handled) return;
      e.preventDefault();
      e.stopPropagation();
      if (result.href) {
        setShortcuts(false);
        setDrawer(false);
        router.push(result.href);
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [router]);

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  const rail = (
    <AdminSidebar badges={badges} collapsed={collapsed} onLogout={logout} onNavigate={() => setDrawer(false)} />
  );

  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-surface">
        {/* Desktop rail */}
        <aside
          className={clsx(
            "sticky top-0 hidden h-screen shrink-0 border-r border-[var(--sidebar-line)] bg-[var(--sidebar-bg)] transition-[width] duration-200 md:block",
            collapsed ? "w-[72px]" : "w-64",
          )}
        >
          {rail}
        </aside>

        {/* Phone drawer */}
        {drawer && (
          <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
            <button type="button" aria-label="Close menu" onClick={() => setDrawer(false)} className="absolute inset-0 bg-black/50" />
            <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-[var(--sidebar-bg)] shadow-neu-lg animate-fade-up">
              <AdminSidebar badges={badges} collapsed={false} onLogout={logout} onNavigate={() => setDrawer(false)} />
            </aside>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <AdminTopbar
            collapsed={collapsed}
            onToggleSidebar={toggleCollapsed}
            onOpenDrawer={() => setDrawer(true)}
            onOpenPalette={() => setPalette(true)}
            onOpenShortcuts={openShortcuts}
          />
          <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-5 sm:px-6 lg:px-8">{children}</main>
        </div>

        {/* Mounted only while open, so every opening starts with a fresh query. */}
        {palette && <CommandPalette onClose={closePalette} onShowShortcuts={openShortcuts} />}
        {shortcuts && <ShortcutsDialog onClose={closeShortcuts} />}
      </div>
    </ToastProvider>
  );
}
