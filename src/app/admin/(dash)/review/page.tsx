import Link from "next/link";
import type { Metadata } from "next";
import { ReviewQueue } from "@/components/admin/ReviewQueue";
import { listReviewQueue } from "@/lib/review";
import { getAdminT } from "@/lib/admin-lang-server";
import { AdminPageHeader } from "@/components/admin/AdminPage";
import { requireAdmin } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAdminT();
  return { title: t("Review queue") };
}

const kbd = "rounded border border-hairline px-1.5 font-mono text-xs";

export default async function ReviewPage() {
  await requireAdmin();
  const { t } = await getAdminT();
  const queue = await listReviewQueue(100);

  return (
    <div className="space-y-4">
      <AdminPageHeader
        className="mb-0"
        title={t("Review queue")}
        count={queue.total}
        description={
          <>
            {t("Imported articles that still need a verdict. Pick one and the article goes on the site, or keep it hidden for later.")}
            <span className="mt-1 block text-xs">
              {t("Keys:")} <kbd className={kbd}>1</kbd> {t("Hoax")} · <kbd className={kbd}>2</kbd> {t("Misleading")} · <kbd className={kbd}>3</kbd> {t("Credible")} ·{" "}
              <kbd className={kbd}>s</kbd> {t("Keep hidden")} · <kbd className={kbd}>d</kbd> {t("Delete")}
            </span>
          </>
        }
        actions={
          <Link href="/admin/articles?visibility=hidden" className="neu-btn px-4 py-2 text-sm">
            {t("All hidden articles")}
          </Link>
        }
      />
      <ReviewQueue items={queue.items} total={queue.total} />
    </div>
  );
}
