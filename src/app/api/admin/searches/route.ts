import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-articles";
import { listSearches, searchFilterFrom } from "@/lib/searches";
import { adminTFromRequest } from "@/lib/admin-lang";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** One page of the search log, filtered like /admin/searches. */
export async function GET(req: Request) {
  const t = adminTFromRequest(req);
  if (!(await isAdmin())) return NextResponse.json({ error: t("Unauthorized") }, { status: 401 });
  const p = new URL(req.url).searchParams;
  const filter = searchFilterFrom((k) => p.get(k) ?? undefined);
  return NextResponse.json(listSearches({ ...filter, pageSize: Math.min(Number(p.get("pageSize")) || 50, 200) }));
}
