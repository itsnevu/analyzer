/**
 * The admin panel's menu, grouped like the legacy panel's (DATA HOAX, HOAX
 * SETTING, …) with the new site's names. Shared by the sidebar, the top bar's
 * breadcrumb and the command palette. Safe for client code.
 *
 * Labels and hints are English dictionary keys (tk); render them with t().
 */

import { tk } from "@/lib/admin-lang";

export type AdminIconName =
  | "dashboard" | "flask" | "cpu" | "search" | "file" | "check" | "alert" | "download"
  | "inbox" | "database" | "globe" | "activity" | "sliders" | "server" | "list";

export interface AdminLink {
  href: string;
  label: string;
  icon: AdminIconName;
  /** one line for the command palette and tooltips */
  hint: string;
  exact?: boolean;
  badge?: "reports" | "review" | "attention";
}

export interface AdminGroup {
  title: string;
  links: AdminLink[];
}

export const ADMIN_NAV: AdminGroup[] = [
  {
    title: tk("Overview"),
    links: [{ href: "/admin", label: tk("Dashboard"), icon: "dashboard", hint: tk("Today's summary and what needs doing"), exact: true }],
  },
  {
    title: tk("Detector"),
    links: [
      { href: "/admin/detect", label: tk("Detection lab"), icon: "flask", hint: tk("Check a text against the fact-check archive") },
      { href: "/admin/model", label: tk("Model"), icon: "cpu", hint: tk("The engine that judges texts: status and training") },
      { href: "/admin/searches", label: tk("Searches"), icon: "search", hint: tk("Every text visitors checked") },
    ],
  },
  {
    title: tk("Content"),
    links: [
      { href: "/admin/articles", label: tk("Articles"), icon: "file", hint: tk("All fact-check articles") },
      { href: "/admin/review", label: tk("Review queue"), icon: "check", hint: tk("Hidden articles waiting for your verdict"), badge: "review" },
      { href: "/admin/attention", label: tk("Needs attention"), icon: "alert", hint: tk("Claims visitors checked that we have no article for yet"), badge: "attention" },
      { href: "/admin/extract", label: tk("Extract from a page"), icon: "download", hint: tk("Turn a link or a message into a draft article") },
      { href: "/admin/reports", label: tk("Reports"), icon: "inbox", hint: tk("Hoax reports and messages from visitors"), badge: "reports" },
    ],
  },
  {
    title: tk("Data"),
    links: [
      { href: "/admin/dataset", label: tk("Dataset"), icon: "database", hint: tk("Labeled examples from the old detector") },
      { href: "/admin/sources", label: tk("Sources"), icon: "globe", hint: tk("Websites the articles were collected from") },
      { href: "/admin/research", label: tk("Research log"), icon: "activity", hint: tk("Visits and checks, with network and device") },
    ],
  },
  {
    title: tk("Settings"),
    links: [
      { href: "/admin/settings", label: tk("Settings"), icon: "sliders", hint: tk("Word lists, HTML tags and skipped websites") },
      { href: "/admin/system", label: tk("System"), icon: "server", hint: tk("Database, backups and maintenance") },
      { href: "/admin/activity", label: tk("Activity log"), icon: "list", hint: tk("What was changed in this panel, and when") },
    ],
  },
];

/** Pages reachable from the menu or below one of its entries, for the breadcrumb. */
const SUB_PAGES: { test: RegExp; label: string }[] = [
  { test: /^\/admin\/articles\/new$/, label: tk("New article") },
  { test: /^\/admin\/articles\/[^/]+\/edit$/, label: tk("Edit article") },
];

export function findAdminLink(pathname: string): { group: AdminGroup; link: AdminLink } | null {
  let best: { group: AdminGroup; link: AdminLink } | null = null;
  for (const group of ADMIN_NAV) {
    for (const link of group.links) {
      const match = link.exact ? pathname === link.href : pathname === link.href || pathname.startsWith(`${link.href}/`);
      if (match && (!best || link.href.length > best.link.href.length)) best = { group, link };
    }
  }
  return best;
}

/** "Admin › Content › Articles › Edit article" as a list of crumbs (dictionary keys); the last one is the current page. */
export function adminBreadcrumb(pathname: string): { label: string; href?: string }[] {
  const crumbs: { label: string; href?: string }[] = [{ label: tk("Admin"), href: "/admin" }];
  const found = findAdminLink(pathname);
  if (!found) return crumbs;
  if (found.link.href !== "/admin") crumbs.push({ label: found.group.title });
  const sub = SUB_PAGES.find((s) => s.test.test(pathname));
  if (sub) {
    crumbs.push({ label: found.link.label, href: found.link.href });
    crumbs.push({ label: sub.label });
  } else {
    crumbs.push({ label: found.link.label });
  }
  return crumbs;
}
