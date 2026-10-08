import { isAdmin } from "@/lib/admin-articles";
import { usageCsv } from "@/lib/usage";
import { adminTFromRequest } from "@/lib/admin-lang";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The research log as CSV; admins only. `anonymized=1` drops IP addresses and raw browser strings. */
export async function GET(req: Request) {
  const t = adminTFromRequest(req);
  if (!(await isAdmin())) return new Response(t("Unauthorized"), { status: 401 });
  const p = new URL(req.url).searchParams;
  const date = (s: string | null) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined);
  const origin = p.get("origin");
  const anonymized = p.get("anonymized") === "1";
  const rows = usageCsv(
    { from: date(p.get("from")), to: date(p.get("to")), origin: origin === "site" || origin === "legacy" ? origin : "", staff: p.get("staff") === "1" },
    anonymized,
  );
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    pull(controller) {
      const next = rows.next();
      if (next.done) controller.close();
      else controller.enqueue(encoder.encode(next.value));
    },
  });
  const name = `usage${anonymized ? "-anonymized" : ""}-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(body, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" },
  });
}
