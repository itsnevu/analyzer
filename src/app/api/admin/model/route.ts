import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-articles";
import { baselineInfo, modelStatus, retrainSchedule } from "@/lib/baseline";
import { getDb } from "@/lib/db";
import { adminTFromRequest } from "@/lib/admin-lang";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Which engine answers public checks, everything known about the baseline model file and its retrain schedule. Admins only. */
export async function GET(req: Request) {
  const t = adminTFromRequest(req);
  if (!(await isAdmin())) return NextResponse.json({ error: t("Unauthorized") }, { status: 401 });
  return NextResponse.json({ status: modelStatus(), baseline: baselineInfo(), schedule: retrainSchedule(getDb()) });
}
