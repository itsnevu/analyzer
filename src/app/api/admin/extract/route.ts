import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-articles";
import { getArticleBySlug } from "@/lib/articles";
import { ExtractError, extractArticle, setSourceSite } from "@/lib/extract";
import { PageError } from "@/lib/fetch-page";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CHARS = 400_000;

/** Turns a link, pasted HTML or text into article fields. Admin only. */
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: { input?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const input = typeof body.input === "string" ? body.input : "";
  if (!input.trim()) return NextResponse.json({ error: "Paste a link, a page's HTML or the text of a message." }, { status: 422 });
  if (input.length > MAX_CHARS) return NextResponse.json({ error: "That is too much text to read at once." }, { status: 413 });

  try {
    return NextResponse.json(await extractArticle(input));
  } catch (err) {
    if (err instanceof ExtractError || err instanceof PageError) return NextResponse.json({ error: err.message }, { status: 422 });
    console.error("[extract] failed:", err);
    return NextResponse.json({ error: "Extraction failed. See the server log." }, { status: 500 });
  }
}

/** Records the source site of an article the tool just saved (the article API does not write that column). */
export async function PATCH(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: { slug?: unknown; sourceSite?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const slug = typeof body.slug === "string" ? body.slug : "";
  const site = typeof body.sourceSite === "string" ? body.sourceSite : "";
  if (!slug || !site) return NextResponse.json({ error: "slug and sourceSite are required." }, { status: 422 });
  if (!(await getArticleBySlug(slug, true))) return NextResponse.json({ error: "No such article." }, { status: 404 });
  if (!setSourceSite(slug, site)) return NextResponse.json({ error: "That is not a site name." }, { status: 422 });
  return NextResponse.json({ ok: true });
}
