import Link from "next/link";
import type { Metadata } from "next";
import { getAdminT } from "@/lib/admin-lang-server";
import { ArticleForm } from "@/components/admin/ArticleForm";
import { AdminPageHeader } from "@/components/admin/AdminPage";
import { requireAdmin } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAdminT();
  return { title: t("Add article") };
}

export default async function NewArticlePage() {
  await requireAdmin();
  const { t } = await getAdminT();
  return (
    <div>
      <AdminPageHeader
        title={t("Add article")}
        description={t("Write a new fact-check. The preview shows how it will look on the site. Press Ctrl+S to save.")}
        actions={
          <Link href="/admin/articles" className="neu-btn px-4 py-2 text-sm">
            {t("← Articles")}
          </Link>
        }
      />
      <ArticleForm mode="new" />
    </div>
  );
}
