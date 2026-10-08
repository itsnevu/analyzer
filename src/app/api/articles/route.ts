import { NextResponse } from "next/server";
import { listArticles } from "@/lib/articles";
import type { Verdict } from "@/lib/detect";
import { limitKey, take, tooMany } from "@/lib/rate-limit";
import { siteTFromRequest } from "@/lib/site-lang";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VERDICTS: Verdict[] = ["valid", "misleading", "hoax"];

// Public, paginated list of published fact-checks: ?q=&lang=&verdict=&source=&year=&page=&pageSize=
export async function GET(req: Request) {
  const limited = take(`articles:${limitKey(req)}`, 120, 60_000);
  if (!limited.ok) {
    const t = siteTFromRequest(req);
    return tooMany(t("Too many requests. Please slow down."), limited.retryAfter);
  }
  const p = new URL(req.url).searchParams;
  const lang = p.get("lang");
  const verdict = p.get("verdict");
  const result = await listArticles({
    q: p.get("q") ?? undefined,
    lang: lang === "id" || lang === "en" ? lang : undefined,
    verdict: VERDICTS.includes(verdict as Verdict) ? (verdict as Verdict) : undefined,
    source: p.get("source") ?? undefined,
    year: p.get("year") ?? undefined,
    page: Number(p.get("page")) || 1,
    pageSize: Math.min(Number(p.get("pageSize")) || 20, 50),
  });
  return NextResponse.json({ articles: result.items, total: result.total, page: result.page, pages: result.pages });
}
