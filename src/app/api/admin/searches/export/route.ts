import { isAdmin } from "@/lib/admin-articles";
import { searchesCsv, searchFilterFrom } from "@/lib/searches";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The filtered search log as CSV; admins only. No IP addresses are in this table. */
export async function GET(req: Request) {
  if (!(await isAdmin())) return new Response("Unauthorized", { status: 401 });
  const p = new URL(req.url).searchParams;
  const rows = searchesCsv(searchFilterFrom((k) => p.get(k) ?? undefined));
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    pull(controller) {
      const next = rows.next();
      if (next.done) controller.close();
      else controller.enqueue(encoder.encode(next.value));
    },
  });
  const name = `searches-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(body, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" },
  });
}
