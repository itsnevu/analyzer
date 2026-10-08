import { AdminLangProvider } from "@/components/admin/AdminLang";
import { getAdminLang } from "@/lib/admin-lang-server";

/** Wraps the whole panel, login included, in the language the ID/EN switch picked. No auth here: see (dash)/layout. */
export default async function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <AdminLangProvider lang={await getAdminLang()}>{children}</AdminLangProvider>;
}
