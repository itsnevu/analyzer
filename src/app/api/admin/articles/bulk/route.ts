import { NextResponse } from "next/server";
import { bulkUpdateArticles, isBulkAction } from "@/lib/articles";
import { isAdmin } from "@/lib/admin-articles";
import { logAdmin } from "@/lib/admin-log";
import type { Verdict } from "@/lib/detect";
import { adminTFromRequest } from "@/lib/admin-lang";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VERDICTS: Verdict[] = ["valid", "misleading", "hoax"];
const MAX_SLUGS = 500;

/**
 * One action for many articles: { slugs: string[], action: "publish" | "hide" | "delete" | "verdict", verdict? }.
 * Runs in a single transaction and is logged with the count. Admins only.
 */
export async function POST(req: Request) {
  const t = adminTFromRequest(req);
  if (!(await isAdmin())) return NextResponse.json({ error: t("Unauthorized") }, { status: 401 });
  let body: { slugs?: unknown; action?: unknown; verdict?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: t("The request could not be read. Reload the page and try again.") }, { status: 400 });
  }
  const slugs = Array.isArray(body.slugs) ? body.slugs.filter((s): s is string => typeof s === "string" && s.trim() !== "") : [];
  if (!slugs.length) return NextResponse.json({ error: t("Select at least one article first.") }, { status: 422 });
  if (slugs.length > MAX_SLUGS) return NextResponse.json({ error: t("You can change at most {max} articles at a time. Select fewer and try again.", { max: MAX_SLUGS }) }, { status: 422 });
  if (!isBulkAction(body.action)) return NextResponse.json({ error: t("This action is not known. Reload the page and try again.") }, { status: 422 });
  const verdict = VERDICTS.includes(body.verdict as Verdict) ? (body.verdict as Verdict) : undefined;
  if (body.action === "verdict" && !verdict) return NextResponse.json({ error: t("Choose a verdict first.") }, { status: 422 });

  const changed = await bulkUpdateArticles(slugs, body.action, verdict);
  const what = body.action === "verdict" ? `verdict → ${verdict}` : body.action;
  logAdmin(req, "article.bulk", what, `${changed} of ${slugs.length} articles: ${slugs.slice(0, 20).join(", ")}${slugs.length > 20 ? ", …" : ""}`);
  return NextResponse.json({ ok: true, action: body.action, verdict, changed });
}
