/**
 * The admin panel's menu, grouped like the legacy panel's (DATA HOAX, HOAX
 * SETTING, …) with the new site's names. Shared by the sidebar, the top bar's
 * breadcrumb and the command palette. Safe for client code.
 */

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
    title: "Overview",
    links: [{ href: "/admin", label: "Dashboard", icon: "dashboard", hint: "Numbers, engine status and the last 7 days", exact: true }],
  },
  {
    title: "Detector",
    links: [
      { href: "/admin/detect", label: "Detection lab", icon: "flask", hint: "Score a text against the archive with six algorithms" },
      { href: "/admin/model", label: "Model", icon: "cpu", hint: "Which engine answers, ping, train, try" },
      { href: "/admin/searches", label: "Searches", icon: "search", hint: "Every text submitted to the detector" },
    ],
  },
  {
    title: "Content",
    links: [
      { href: "/admin/articles", label: "Articles", icon: "file", hint: "The fact-check archive" },
      { href: "/admin/review", label: "Review queue", icon: "check", hint: "Hidden entries waiting for a verdict", badge: "review" },
      { href: "/admin/attention", label: "Needs attention", icon: "alert", hint: "Claims people checked that the archive could not answer", badge: "attention" },
      { href: "/admin/extract", label: "Extract from a page", icon: "download", hint: "Turn a link or message into a draft article" },
      { href: "/admin/reports", label: "Reports", icon: "inbox", hint: "Hoax reports and messages from visitors", badge: "reports" },
    ],
  },
  {
    title: "Data",
    links: [
      { href: "/admin/dataset", label: "Dataset", icon: "database", hint: "The old detector's 17k labeled rows" },
      { href: "/admin/sources", label: "Sources", icon: "globe", hint: "The sites the archive was collected from" },
      { href: "/admin/research", label: "Research log", icon: "activity", hint: "Visits and checks with network and device" },
    ],
  },
  {
    title: "Settings",
    links: [
      { href: "/admin/settings", label: "Settings", icon: "sliders", hint: "Stopwords, HTML tags, skipped domains" },
      { href: "/admin/system", label: "System", icon: "server", hint: "Database, backups, maintenance" },
      { href: "/admin/activity", label: "Activity log", icon: "list", hint: "What was changed in this panel, and when" },
    ],
  },
];

/** Pages reachable from the menu or below one of its entries, for the breadcrumb. */
const SUB_PAGES: { test: RegExp; label: string }[] = [
  { test: /^\/admin\/articles\/new$/, label: "New article" },
  { test: /^\/admin\/articles\/[^/]+\/edit$/, label: "Edit article" },
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

/** "Admin › Content › Articles › Edit article" as a list of crumbs; the last one is the current page. */
export function adminBreadcrumb(pathname: string): { label: string; href?: string }[] {
  const crumbs: { label: string; href?: string }[] = [{ label: "Admin", href: "/admin" }];
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
