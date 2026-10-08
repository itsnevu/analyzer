import Link from "next/link";
import { ArticleForm } from "@/components/admin/ArticleForm";
import { AdminPageHeader } from "@/components/admin/AdminPage";

export const dynamic = "force-dynamic";

export default function NewArticlePage() {
  return (
    <div>
      <AdminPageHeader
        title="Add article"
        description="Write a fact-check for the archive. The preview shows how the card and the article page will look; Ctrl+S saves."
        actions={
          <Link href="/admin/articles" className="neu-btn px-4 py-2 text-sm">
            ← Articles
          </Link>
        }
      />
      <ArticleForm mode="new" />
    </div>
  );
}
