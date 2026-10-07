import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-articles";
import { listSearches, searchFilterFrom } from "@/lib/searches";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** One page of the search log, filtered like /admin/searches. */
export async function GET(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const p = new URL(req.url).searchParams;
  const filter = searchFilterFrom((k) => p.get(k) ?? undefined);
  return NextResponse.json(listSearches({ ...filter, pageSize: Math.min(Number(p.get("pageSize")) || 50, 200) }));
}
