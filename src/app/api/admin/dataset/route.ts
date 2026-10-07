import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-articles";
import { datasetFilterFrom, listDataset } from "@/lib/dataset-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** One page of the legacy dataset, filtered like /admin/dataset. */
export async function GET(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const p = new URL(req.url).searchParams;
  const filter = datasetFilterFrom((k) => p.get(k) ?? undefined);
  return NextResponse.json(listDataset({ ...filter, pageSize: Math.min(Number(p.get("pageSize")) || 50, 200) }));
}
