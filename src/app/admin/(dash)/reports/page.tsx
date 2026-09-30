import Link from "next/link";
import { getReportCounts, listReports, REPORT_STATUSES, type ReportKind, type ReportStatus } from "@/lib/reports";
import { ReportsList } from "@/components/admin/ReportsList";
import { formatCount } from "@/lib/sources";
import { clsx } from "@/lib/clsx";

export const dynamic = "force-dynamic";

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

const KINDS: { key: "" | ReportKind; label: string }[] = [
  { key: "", label: "Everything" },
  { key: "report", label: "Hoax reports" },
  { key: "contact", label: "Contact messages" },
];

export default async function AdminReportsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const kind = one(sp.kind) === "report" || one(sp.kind) === "contact" ? (one(sp.kind) as ReportKind) : undefined;
  const status = one(sp.status) in REPORT_STATUSES ? (one(sp.status) as ReportStatus) : undefined;
  const [reports, counts] = await Promise.all([listReports({ kind, status }), getReportCounts()]);

  const href = (next: { kind?: string; status?: string }) => {
    const p = new URLSearchParams();
    const k = next.kind ?? kind ?? "";
    const s = next.status ?? status ?? "";
    if (k) p.set("kind", k);
    if (s) p.set("status", s);
    const q = p.toString();
    return q ? `/admin/reports?${q}` : "/admin/reports";
  };
  const chip = (active: boolean) =>
    clsx("rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors", active ? "bg-ink text-surface-raised" : "text-ink-muted hover:bg-surface-sunken hover:text-ink");

  return (
    <div className="space-y-4">
      <div>
        <span className="eyebrow">Inbox</span>
        <h1 className="mt-2 font-display text-2xl font-bold">
          Reports ({formatCount(counts.total)})
          {counts.unread > 0 && <span className="ml-2 align-middle text-sm font-medium text-verdict-hoax">{counts.unread} unread</span>}
        </h1>
      </div>

      <div className="neu flex flex-wrap items-center gap-1 p-2">
        {KINDS.map((k) => (
          <Link key={k.key} href={href({ kind: k.key })} className={chip((kind ?? "") === k.key)}>
            {k.label}
          </Link>
        ))}
        <span className="mx-1 hidden h-5 w-px bg-hairline sm:block" />
        <Link href={href({ status: "" })} className={chip(!status)}>
          Any status
        </Link>
        {Object.entries(REPORT_STATUSES).map(([key, label]) => (
          <Link key={key} href={href({ status: key })} className={chip(status === key)}>
            {label}
          </Link>
        ))}
      </div>

      <ReportsList reports={reports} />
    </div>
  );
}
