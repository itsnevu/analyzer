import { adminArticleFilterFrom, articlesCsv } from "@/lib/articles";
import { isAdmin } from "@/lib/admin-articles";
import { SITE_URL } from "@/lib/site";
import { adminTFromRequest } from "@/lib/admin-lang";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The filtered article list as CSV (one row per article, no bodies); admins only. Same parameters as /admin/articles. */
export async function GET(req: Request) {
  const t = adminTFromRequest(req);
  if (!(await isAdmin())) return new Response(t("Unauthorized"), { status: 401 });
  const p = new URL(req.url).searchParams;
  const rows = articlesCsv(adminArticleFilterFrom((k) => p.get(k) ?? undefined), SITE_URL);
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    pull(controller) {
      const next = rows.next();
      if (next.done) controller.close();
      else controller.enqueue(encoder.encode(next.value));
    },
  });
  const name = `articles-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(body, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" },
  });
}
