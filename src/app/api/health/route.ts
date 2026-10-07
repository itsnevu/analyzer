import { NextResponse } from "next/server";
import { getArticleStats } from "@/lib/articles";
import { hasFts } from "@/lib/db";
import { modelStatus } from "@/lib/baseline";
import pkg from "../../../../package.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Liveness check for pm2, Cloudflare and uptime monitors: GET /api/health.
 * 200 with ok: true when the database answers, 503 when it does not. No auth,
 * one cheap aggregate query, never cached.
 */
export async function GET() {
  const base = {
    time: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    version: pkg.version,
    // "external" | "baseline" (the trained classifier) | "heuristic" (nothing trained yet)
    model: modelStatus().engine,
  };
  const headers = { "Cache-Control": "no-store" };
  try {
    const stats = await getArticleStats();
    return NextResponse.json(
      { ok: true, ...base, db: { ok: true, articles: stats.total + stats.hidden, published: stats.total }, fts: hasFts() },
      { headers },
    );
  } catch (err) {
    console.error("[health] database check failed:", err);
    return NextResponse.json(
      { ok: false, ...base, db: { ok: false, error: err instanceof Error ? err.message : String(err) }, fts: false },
      { status: 503, headers },
    );
  }
}
