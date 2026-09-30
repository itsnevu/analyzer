import { getAllReports } from "@/lib/reports";
import { ReportsList } from "@/components/admin/ReportsList";

export const dynamic = "force-dynamic";

export default async function AdminReportsPage() {
  const reports = await getAllReports();
  return (
    <div className="space-y-4">
      <div>
        <span className="eyebrow">Inbox</span>
        <h1 className="mt-2 font-display text-2xl font-bold">Reports ({reports.length})</h1>
      </div>
      <ReportsList reports={reports} />
    </div>
  );
}
