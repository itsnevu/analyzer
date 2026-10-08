import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-articles";
import { pingModel } from "@/lib/detect";
import { adminTFromRequest, type AdminT } from "@/lib/admin-lang";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sends a short sample text to the configured external model and reports
 * reachability, HTTP status, latency and whether the answer followed the
 * contract. The API key never leaves the server. Admins only.
 */
export async function POST(req: Request) {
  const t = adminTFromRequest(req);
  if (!(await isAdmin())) return NextResponse.json({ error: t("Unauthorized") }, { status: 401 });
  if (!process.env.MODEL_API_URL) return NextResponse.json({ error: t("No external model is configured (MODEL_API_URL is empty).") }, { status: 409 });
  const result = await pingModel();
  return NextResponse.json(result.error ? { ...result, error: pingProblem(result.error, t) } : result);
}

/** The ping's problem in the admin's language; HTTP codes and network errors stay as they are. */
function pingProblem(error: string, t: AdminT): string {
  const timeout = /^no answer within (\d+) ms$/.exec(error);
  if (timeout) return t("no answer within {ms} ms", { ms: timeout[1] });
  return t(error);
}
