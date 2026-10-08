import Link from "next/link";
import { AttentionQueue } from "@/components/admin/AttentionQueue";
import { ATTENTION_DAYS, attentionDays, attentionTab, listAttention, listDisagreements, listLowConfidence } from "@/lib/attention";
import { clsx } from "@/lib/clsx";
import { requireAdmin } from "@/lib/require-admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Needs attention" };

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function AttentionPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireAdmin();
  const sp = await searchParams;
  const days = attentionDays(one(sp.days));
  const tab = attentionTab(one(sp.tab));
  const unmatched = listAttention(days);
  const disagreements = listDisagreements(days);
  const lowConfidence = listLowConfidence(days);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-[1.75rem]">Needs attention</h1>
          <p className="mt-1 max-w-3xl text-sm text-ink-muted">
            Claims people checked that the archive could not answer, so the missing fact-check can be written, plus the matches that look
            wrong.
          </p>
        </div>
        <div className="neu flex items-center gap-1 p-1" role="group" aria-label="Period">
          {ATTENTION_DAYS.map((d) => (
            <Link
              key={d}
              href={`/admin/attention?days=${d}&tab=${tab}`}
              className={clsx(
                "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                d === days ? "bg-ink text-surface-raised" : "text-ink-muted hover:bg-surface-sunken hover:text-ink",
              )}
            >
              {d} days
            </Link>
          ))}
        </div>
      </div>

      <AttentionQueue key={days} days={days} tab={tab} unmatched={unmatched} disagreements={disagreements} lowConfidence={lowConfidence} />
    </div>
  );
}
