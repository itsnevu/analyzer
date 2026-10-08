import Link from "next/link";
import type { Metadata } from "next";
import { AttentionQueue } from "@/components/admin/AttentionQueue";
import { ATTENTION_DAYS, attentionDays, attentionTab, listAttention, listDisagreements, listLowConfidence } from "@/lib/attention";
import { getAdminT } from "@/lib/admin-lang-server";
import { AdminPageHeader } from "@/components/admin/AdminPage";
import { clsx } from "@/lib/clsx";
import { requireAdmin } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAdminT();
  return { title: t("Needs attention") };
}

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function AttentionPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireAdmin();
  const { t } = await getAdminT();
  const sp = await searchParams;
  const days = attentionDays(one(sp.days));
  const tab = attentionTab(one(sp.tab));
  const unmatched = listAttention(days);
  const disagreements = listDisagreements(days);
  const lowConfidence = listLowConfidence(days);

  return (
    <div className="space-y-4">
      <AdminPageHeader
        className="mb-0"
        title={t("Needs attention")}
        description={t("Things people checked that the archive could not answer well. Write the missing fact-check, or fix a wrong match.")}
        actions={
          <div className="neu flex items-center gap-1 p-1" role="group" aria-label={t("Period")}>
            {ATTENTION_DAYS.map((d) => (
              <Link
                key={d}
                href={`/admin/attention?days=${d}&tab=${tab}`}
                aria-current={d === days ? "true" : undefined}
                className={clsx(
                  "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                  d === days ? "bg-ink text-surface-raised" : "text-ink-muted hover:bg-surface-sunken hover:text-ink",
                )}
              >
                {t("{n} days", { n: d })}
              </Link>
            ))}
          </div>
        }
      />

      <AttentionQueue key={days} days={days} tab={tab} unmatched={unmatched} disagreements={disagreements} lowConfidence={lowConfidence} />
    </div>
  );
}
