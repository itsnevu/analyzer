import { NextResponse } from "next/server";
import { runDetection, type DetectionResult } from "@/lib/detect";
import { findSimilarArticles, type ArticleListItem } from "@/lib/articles";
import { VERDICT_META } from "@/lib/verdict";
import { recordSearch } from "@/lib/searches";

export const runtime = "nodejs";

const MAX_CHARS = 20_000;

/**
 * Demo mode only: a claim that was already fact-checked is judged by that fact-check
 * instead of the keyword heuristic. A real model's verdict is always kept as it is.
 */
function withArchiveVerdict(result: DetectionResult, related: ArticleListItem[]): DetectionResult {
  const top = related[0];
  if (!result.simulated || !top) return result;
  const p = result.hoaxProbability;
  const hoaxProbability =
    top.verdict === "hoax" ? Math.max(p, 0.85) : top.verdict === "misleading" ? Math.min(Math.max(p, 0.55), 0.7) : Math.min(p, 0.25);
  return {
    ...result,
    verdict: top.verdict,
    hoaxProbability,
    confidence: 0.75,
    category: top.category,
    explanation:
      `Your text closely matches a claim that was already fact-checked: “${top.title}”, rated ${VERDICT_META[top.verdict].labelEn.toLowerCase()}. ` +
      "Open the matching fact-checks below for the full explanation and sources.",
    signals: [{ label: "matches an archived fact-check", kind: top.verdict === "valid" ? "trust" : "risk" }, ...result.signals],
    model: `archive match + ${result.model}`,
  };
}

export async function POST(req: Request) {
  let body: { text?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const text = (body.text ?? "").toString();
  if (text.trim().length < 15) {
    return NextResponse.json(
      { error: "Text is too short. Enter at least 15 characters to analyze." },
      { status: 422 },
    );
  }
  if (text.length > MAX_CHARS) {
    return NextResponse.json(
      { error: `Text is too long. Paste at most ${MAX_CHARS.toLocaleString("en-US")} characters.` },
      { status: 413 },
    );
  }

  try {
    // The archive lookup does not depend on the model, so a slow or failing lookup never hides the verdict.
    const [result, related] = await Promise.all([
      runDetection(text),
      findSimilarArticles(text, 4).catch((err) => {
        console.error("[detect] archive lookup failed:", err);
        return [];
      }),
    ]);
    const final = withArchiveVerdict(result, related);
    // Feeds the admin dashboard's search statistics: the text and verdict only, no IP (disclosed on the detector and in the FAQ).
    try {
      recordSearch(text, final.verdict);
    } catch (err) {
      console.error("[detect] could not record search:", err);
    }
    return NextResponse.json({ ...final, related });
  } catch (err) {
    console.error("[detect] failed:", err);
    return NextResponse.json(
      { error: "Failed to analyze the text. Please try again shortly." },
      { status: 502 },
    );
  }
}
