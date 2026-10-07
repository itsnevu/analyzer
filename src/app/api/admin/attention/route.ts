import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-articles";
import { attentionDays, listAttention, listDisagreements, listLowConfidence } from "@/lib/attention";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The three "needs attention" lists for the last ?days= (7, 30 or 90; default 30). Admin only. */
export async function GET(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const days = attentionDays(new URL(req.url).searchParams.get("days"));
  return NextResponse.json({
    days,
    unmatched: listAttention(days),
    disagreements: listDisagreements(days),
    lowConfidence: listLowConfidence(days),
  });
}
