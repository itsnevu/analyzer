import { redirect } from "next/navigation";
import { isAdmin } from "./admin-articles";

/**
 * The first line of every admin page. The proxy and the admin layout check the
 * session as well, but a page must not rely on them: the framework can render
 * a page on its own (for page-data requests) without running its layouts.
 */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) redirect("/admin/login");
}
