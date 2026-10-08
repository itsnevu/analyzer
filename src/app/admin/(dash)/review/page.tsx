import Link from "next/link";
import { ReviewQueue } from "@/components/admin/ReviewQueue";
import { listReviewQueue } from "@/lib/review";
import { formatCount } from "@/lib/sources";
import { requireAdmin } from "@/lib/require-admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Review queue" };

export default async function ReviewPage() {
  await requireAdmin();
  const queue = await listReviewQueue(100);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-[1.75rem]">Review queue ({formatCount(queue.total)})</h1>
          <p className="mt-1 max-w-3xl text-sm text-ink-muted">
            Articles imported without a verdict from their publisher. Pick one to publish the article, keep it hidden for later, or delete
            it. Keyboard: <kbd className="rounded border border-hairline px-1 font-mono text-xs">1</kbd> hoax,{" "}
            <kbd className="rounded border border-hairline px-1 font-mono text-xs">2</kbd> misleading,{" "}
            <kbd className="rounded border border-hairline px-1 font-mono text-xs">3</kbd> credible,{" "}
            <kbd className="rounded border border-hairline px-1 font-mono text-xs">s</kbd> skip,{" "}
            <kbd className="rounded border border-hairline px-1 font-mono text-xs">d</kbd> delete.
          </p>
        </div>
        <Link href="/admin/articles?visibility=hidden" className="neu-btn px-4 py-2 text-sm">
          All hidden articles
        </Link>
      </div>
      <ReviewQueue items={queue.items} total={queue.total} />
    </div>
  );
}
