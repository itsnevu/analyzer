import fs from "node:fs";
import { isAdmin } from "@/lib/admin-articles";
import { getReport } from "@/lib/reports";
import { reportAttachmentPath } from "@/lib/uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The screenshot attached to a report; admins only. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return new Response("Unauthorized", { status: 401 });
  const report = await getReport(Number((await params).id));
  if (!report?.attachment) return new Response("Not found", { status: 404 });
  try {
    const file = fs.readFileSync(reportAttachmentPath(report.attachment));
    return new Response(new Uint8Array(file), {
      headers: { "Content-Type": "image/webp", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
