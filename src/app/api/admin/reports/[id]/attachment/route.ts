import fs from "node:fs";
import { isAdmin } from "@/lib/admin-articles";
import { getReport } from "@/lib/reports";
import { reportAttachmentPath } from "@/lib/uploads";
import { adminTFromRequest } from "@/lib/admin-lang";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The screenshot attached to a report; admins only. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const t = adminTFromRequest(req);
  if (!(await isAdmin())) return new Response(t("Unauthorized"), { status: 401 });
  const report = await getReport(Number((await params).id));
  if (!report?.attachment) return new Response(t("This item was not found. It may have been deleted already; reload the page."), { status: 404 });
  try {
    const file = fs.readFileSync(reportAttachmentPath(report.attachment));
    return new Response(new Uint8Array(file), {
      headers: { "Content-Type": "image/webp", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
    });
  } catch {
    return new Response(t("This item was not found. It may have been deleted already; reload the page."), { status: 404 });
  }
}
