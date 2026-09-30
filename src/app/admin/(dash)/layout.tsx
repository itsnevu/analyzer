import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession, SESSION_COOKIE } from "@/lib/auth";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

export const dynamic = "force-dynamic";

export default async function AdminDashLayout({ children }: { children: React.ReactNode }) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!verifySession(token)) redirect("/admin/login");

  return (
    <div className="container-page py-4">
      <div className="grid gap-4 md:grid-cols-[220px_1fr]">
        <AdminSidebar />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
