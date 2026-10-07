import { isAdmin } from "@/lib/admin-articles";
import { datasetCsv, datasetFilterFrom } from "@/lib/dataset-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The filtered dataset as CSV; admins only. */
export async function GET(req: Request) {
  if (!(await isAdmin())) return new Response("Unauthorized", { status: 401 });
  const p = new URL(req.url).searchParams;
  const rows = datasetCsv(datasetFilterFrom((k) => p.get(k) ?? undefined));
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    pull(controller) {
      const next = rows.next();
      if (next.done) controller.close();
      else controller.enqueue(encoder.encode(next.value));
    },
  });
  const name = `dataset-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(body, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" },
  });
}
