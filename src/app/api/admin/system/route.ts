import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-articles";
import { backupsInfo, configInfo, databaseInfo, filesInfo, runtimeInfo } from "@/lib/system";
import { adminTFromRequest } from "@/lib/admin-lang";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Everything /admin/system shows, as JSON. Admins only; no secrets are included. */
export async function GET(req: Request) {
  const t = adminTFromRequest(req);
  if (!(await isAdmin())) return NextResponse.json({ error: t("Unauthorized") }, { status: 401 });
  return NextResponse.json({
    runtime: runtimeInfo(),
    database: databaseInfo(),
    backups: backupsInfo(),
    config: configInfo(),
    files: filesInfo(),
  });
}
