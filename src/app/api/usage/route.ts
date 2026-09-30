import { isAdmin } from "@/lib/admin-articles";
import { clientIp, take } from "@/lib/rate-limit";
import { attachProfile, readClientMeta, recordUsage } from "@/lib/usage";

export const runtime = "nodejs";

/** Visits and self-reported roles for the research log (see /privacy). */
export async function POST(req: Request) {
  if (!take(`usage:${clientIp(req)}`, 60, 10 * 60_000).ok) return new Response(null, { status: 204 });
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(null, { status: 400 });
  }
  const meta = readClientMeta(body.meta);
  const staff = await isAdmin();
  if (body.kind === "visit") {
    recordUsage(req, "visit", meta, {}, staff);
  } else if (body.kind === "profile" && meta.role) {
    recordUsage(req, "profile", meta, {}, staff);
    if (Number(body.checkId) > 0) attachProfile(Number(body.checkId), meta.visitor, meta.role, meta.organization);
  }
  return new Response(null, { status: 204 });
}
