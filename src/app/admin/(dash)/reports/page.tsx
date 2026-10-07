import Link from "next/link";
import { getReportCounts, listReports, REPORT_STATUSES, REPORT_TYPES, type ReportKind, type ReportStatus, type ReportType } from "@/lib/reports";
import { ReportsList } from "@/components/admin/ReportsList";
import { formatCount } from "@/lib/sources";
import { clsx } from "@/lib/clsx";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reports" };

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
  const type = one(sp.type) in REPORT_TYPES ? (one(sp.type) as ReportType) : undefined;
  const status = one(sp.status) in REPORT_STATUSES ? (one(sp.status) as ReportStatus) : undefined;
  const unread = one(sp.unread) === "1";
  const [reports, counts, scoped] = await Promise.all([listReports({ kind, type, status, unread }), getReportCounts(), getReportCounts({ kind, type })]);

  const href = (next: Partial<Record<"kind" | "type" | "status" | "unread", string>>) => {
    const p = new URLSearchParams();
    const values = { kind: kind ?? "", type: type ?? "", status: status ?? "", unread: unread ? "1" : "", ...next };
    // Contact messages have no type.
    if (values.kind === "contact") values.type = "";
    for (const [k, v] of Object.entries(values)) if (v) p.set(k, v);
    const q = p.toString();
    return q ? `/admin/reports?${q}` : "/admin/reports";
  };
  const chip = (active: boolean) =>
    clsx("rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors", active ? "bg-ink text-surface-raised" : "text-ink-muted hover:bg-surface-sunken hover:text-ink");
  const count = (n: number, active: boolean) => <span className={clsx("ml-1 tabular-nums", active ? "opacity-70" : "text-ink-faint")}>{formatCount(n)}</span>;

  return (
    <div className="space-y-4">
      <div>
        <span className="eyebrow">Inbox</span>
        <h1 className="mt-2 font-display text-2xl font-bold">
          Reports ({formatCount(counts.total)})
          {counts.unread > 0 && <span className="ml-2 align-middle text-sm font-medium text-verdict-hoax">{counts.unread} unread</span>}
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-ink-muted">
          What people reported or wrote in. Open one to see the fact-checks already in the archive about it, send it to the detection lab,
          turn it into a draft, leave a note, or mark which article answers it.
        </p>
      </div>

      <div className="neu flex flex-wrap items-center gap-1 p-2">
        {KINDS.map((k) => (
          <Link key={k.key} href={href({ kind: k.key })} className={chip((kind ?? "") === k.key)}>
            {k.label}
          </Link>
        ))}
        {kind !== "contact" && (
          <>
            <span className="mx-1 hidden h-5 w-px bg-hairline sm:block" />
            {(Object.keys(REPORT_TYPES) as ReportType[]).map((key) => (
              <Link key={key} href={href({ type: type === key ? "" : key, kind: kind ?? "report" })} className={chip(type === key)}>
                {REPORT_TYPES[key]}
              </Link>
            ))}
          </>
        )}
      </div>

      <div className="neu flex flex-wrap items-center gap-1 p-2">
        <Link href={href({ status: "" })} className={chip(!status)}>
          Any status{count(scoped.total, !status)}
        </Link>
        {(Object.keys(REPORT_STATUSES) as ReportStatus[]).map((key) => (
          <Link key={key} href={href({ status: status === key ? "" : key })} className={chip(status === key)}>
            {REPORT_STATUSES[key]}
            {count(scoped.byStatus[key], status === key)}
          </Link>
        ))}
        <span className="mx-1 hidden h-5 w-px bg-hairline sm:block" />
        <Link href={href({ unread: unread ? "" : "1" })} className={chip(unread)}>
          Unread only{count(scoped.unread, unread)}
        </Link>
      </div>

      <ReportsList key={`${kind ?? ""}|${type ?? ""}|${status ?? ""}|${unread ? 1 : 0}`} reports={reports} />
    </div>
  );
}
