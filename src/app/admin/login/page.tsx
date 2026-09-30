import type { Metadata } from "next";
import { LoginForm } from "@/components/admin/LoginForm";
import { authConfigProblem, usingDevDefaults } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin sign in",
  robots: { index: false, follow: false },
};

export default function AdminLoginPage() {
  const problem = authConfigProblem();
  const notice = problem
    ? `Admin login is disabled on this server. ${problem} Run \`npm run setup\` on the server, then restart it.`
    : usingDevDefaults()
      ? "Development mode: the default password is admin123. Set ADMIN_PASSWORD and AUTH_SECRET (npm run setup) before the site goes online."
      : undefined;
  return <LoginForm notice={notice} disabled={Boolean(problem)} />;
}
