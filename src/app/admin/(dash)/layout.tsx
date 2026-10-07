import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession, SESSION_COOKIE } from "@/lib/auth";
import { getReportCounts } from "@/lib/reports";
import { getArticleStats } from "@/lib/articles";
import { countOpenAttention } from "@/lib/attention";
import { AdminShell } from "@/components/admin/AdminShell";

export const dynamic = "force-dynamic";

export default async function AdminDashLayout({ children }: { children: React.ReactNode }) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!verifySession(token)) redirect("/admin/login");
  const [{ unread }, stats] = await Promise.all([getReportCounts(), getArticleStats()]);
  // A badge must never take the whole panel down.
  let attention = 0;
  try {
    attention = countOpenAttention(30);
  } catch (err) {
    console.error("[admin] attention count failed:", err);
  }

  return <AdminShell badges={{ reports: unread, review: stats.hidden, attention }}>{children}</AdminShell>;
}
