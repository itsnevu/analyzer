import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-articles";
import { getArticleBySlug } from "@/lib/articles";
import { ExtractError, extractArticle, setSourceSite } from "@/lib/extract";
import { PageError } from "@/lib/fetch-page";
import { translateError } from "@/lib/message-error";
import { adminTFromRequest } from "@/lib/admin-lang";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CHARS = 400_000;

/** Turns a link, pasted HTML or text into article fields. Admin only. */
export async function POST(req: Request) {
  const t = adminTFromRequest(req);
  if (!(await isAdmin())) return NextResponse.json({ error: t("Unauthorized") }, { status: 401 });
  let body: { input?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: t("The request could not be read. Reload the page and try again.") }, { status: 400 });
  }
  const input = typeof body.input === "string" ? body.input : "";
  if (!input.trim()) return NextResponse.json({ error: t("Paste a link, a page's HTML or the text of a message.") }, { status: 422 });
  if (input.length > MAX_CHARS) return NextResponse.json({ error: t("That is too much text to read at once. Paste a shorter part.") }, { status: 413 });

  try {
    const result = await extractArticle(input);
    return NextResponse.json({ ...result, notes: result.notes.map((note) => t(note)) });
  } catch (err) {
    if (err instanceof ExtractError || err instanceof PageError) return NextResponse.json({ error: translateError(err, t) }, { status: 422 });
    console.error("[extract] failed:", err);
    return NextResponse.json({ error: t("Reading the page failed because of a problem on the server. Try again; if it keeps failing, check the server log.") }, { status: 500 });
  }
}

/** Records the source site of an article the tool just saved (the article API does not write that column). */
export async function PATCH(req: Request) {
  const t = adminTFromRequest(req);
  if (!(await isAdmin())) return NextResponse.json({ error: t("Unauthorized") }, { status: 401 });
  let body: { slug?: unknown; sourceSite?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: t("The request could not be read. Reload the page and try again.") }, { status: 400 });
  }
  const slug = typeof body.slug === "string" ? body.slug : "";
  const site = typeof body.sourceSite === "string" ? body.sourceSite : "";
  if (!slug || !site) return NextResponse.json({ error: t("The article and its source site are both needed.") }, { status: 422 });
  if (!(await getArticleBySlug(slug, true))) return NextResponse.json({ error: t("That article no longer exists. It may have been deleted.") }, { status: 404 });
  if (!setSourceSite(slug, site)) return NextResponse.json({ error: t("That is not a valid site name.") }, { status: 422 });
  return NextResponse.json({ ok: true });
}
