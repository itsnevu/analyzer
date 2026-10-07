import Link from "next/link";
import { ArticleForm } from "@/components/admin/ArticleForm";

export const dynamic = "force-dynamic";

export default function NewArticlePage() {
  return (
    <div className="space-y-4">
      <div>
        <Link href="/admin/articles" className="text-sm text-ink-muted hover:text-ink">← Articles</Link>
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-[1.75rem]">Add Article</h1>
      </div>
      <ArticleForm mode="new" />
    </div>
  );
}
