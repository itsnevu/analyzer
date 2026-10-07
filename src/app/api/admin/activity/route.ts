import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-articles";
import { adminLogActions, adminLogFilterFrom, listAdminLog } from "@/lib/admin-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** One page of the activity log, filtered like /admin/activity: ?action=&from=&to=&page=&pageSize= */
export async function GET(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const p = new URL(req.url).searchParams;
  const filter = adminLogFilterFrom((k) => p.get(k) ?? undefined);
  return NextResponse.json({ ...listAdminLog({ ...filter, pageSize: Math.min(Number(p.get("pageSize")) || 100, 500) }), actions: adminLogActions() });
}
