import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-articles";
import { pingModel } from "@/lib/detect";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sends a short sample text to the configured external model and reports
 * reachability, HTTP status, latency and whether the answer followed the
 * contract. The API key never leaves the server. Admins only.
 */
export async function POST() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.RAG_FUSION_API_URL) return NextResponse.json({ error: "No external model is configured (RAG_FUSION_API_URL is empty)." }, { status: 409 });
  return NextResponse.json(await pingModel());
}
