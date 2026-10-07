import { isAdmin } from "@/lib/admin-articles";
import { adminLogCsv, adminLogFilterFrom } from "@/lib/admin-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The filtered activity log as CSV; admins only. */
export async function GET(req: Request) {
  if (!(await isAdmin())) return new Response("Unauthorized", { status: 401 });
  const p = new URL(req.url).searchParams;
  const rows = adminLogCsv(adminLogFilterFrom((k) => p.get(k) ?? undefined));
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    pull(controller) {
      const next = rows.next();
      if (next.done) controller.close();
      else controller.enqueue(encoder.encode(next.value));
    },
  });
  const name = `activity-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(body, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" },
  });
}
