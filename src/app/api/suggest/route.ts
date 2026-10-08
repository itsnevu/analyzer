import { NextResponse } from "next/server";
import { listArticles } from "@/lib/articles";
import { limitKey, take, tooMany } from "@/lib/rate-limit";
import { siteTFromRequest } from "@/lib/site-lang";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_QUERY = 100;
const LIMIT = 6;

/** Search-box suggestions: up to six published fact-checks matching ?q= (two characters or more). */
export async function GET(req: Request) {
  const limited = take(`suggest:${limitKey(req)}`, 120, 60_000);
  if (!limited.ok) {
    const t = siteTFromRequest(req);
    return tooMany(t("Too many requests. Please slow down."), limited.retryAfter);
  }
  const q = (new URL(req.url).searchParams.get("q") ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_QUERY);
  const headers = { "Cache-Control": "public, max-age=60" };
  if (q.length < 2) return NextResponse.json({ suggestions: [] }, { headers });
  const { items } = await listArticles({ q, pageSize: LIMIT });
  const suggestions = items.map(({ slug, title, verdict, sourceSite, date }) => ({ slug, title, verdict, sourceSite, date }));
  return NextResponse.json({ suggestions }, { headers });
}
