import { NextResponse } from "next/server";
import { runDetection, type DetectionResult } from "@/lib/detect";
import { findSimilarArticles, type ArticleListItem } from "@/lib/articles";
import { VERDICT_META } from "@/lib/verdict";
import { recordSearch } from "@/lib/searches";
import { readClientMeta, recordUsage, type UsageFields } from "@/lib/usage";
import { isAdmin } from "@/lib/admin-articles";
import { clientIp, take, tooMany } from "@/lib/rate-limit";
import { asSingleUrl, PageError, readPage } from "@/lib/fetch-page";
import { isSkippedDomain } from "@/lib/settings";

export const runtime = "nodejs";

const MAX_CHARS = 20_000;

/**
 * A claim that was already fact-checked is judged by that fact-check instead of
 * the local engines (classifier or heuristic). An external model's verdict is
 * always kept as it is.
 */
function withArchiveVerdict(result: DetectionResult, related: ArticleListItem[]): DetectionResult {
  const top = related[0];
  if (result.engine === "external" || !top) return result;
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
  const ip = clientIp(req);
  for (const [key, limit, windowMs] of [[`detect:${ip}`, 20, 60_000], [`detect-day:${ip}`, 400, 24 * 60 * 60_000]] as const) {
    const r = take(key, limit, windowMs);
    if (!r.ok) return tooMany("Too many checks from your network. Please wait a moment and try again.", r.retryAfter);
  }

  let body: { text?: string; meta?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const input = (body.text ?? "").toString();
  const started = Date.now();
  const meta = readClientMeta(body.meta);
  const staff = await isAdmin();
  // Every attempt goes to the research log (see /privacy), failed ones with the reason.
  const log = (fields: UsageFields) =>
    recordUsage(req, "check", meta, { text: input, input: asSingleUrl(input) ? "link" : "text", ms: Date.now() - started, ...fields }, staff);
  let text = input;
  let source: { url: string; title: string } | undefined;

  // A pasted link: read the page and check its text instead.
  const link = asSingleUrl(input);
  if (link) {
    // Sites on the admin's skip list (social networks, archive mirrors) are never fetched.
    let host = "";
    try {
      host = new URL(link).hostname;
    } catch {
      /* readPage reports the bad link below */
    }
    if (host && isSkippedDomain(host)) {
      log({ url: link, error: "skipped-domain" });
      return NextResponse.json({ error: "That site is on the skip list, so its pages are not read. Paste the text instead." }, { status: 422 });
    }
    const limited = take(`detect-link:${ip}`, 10, 60_000);
    if (!limited.ok) return tooMany("Too many links in a short time. Please wait a moment.", limited.retryAfter);
    try {
      const page = await readPage(link);
      text = page.text;
      source = { url: page.url, title: page.title };
    } catch (err) {
      log({ url: link, error: "link-unreadable" });
      const message = err instanceof PageError ? err.message : "The page could not be read.";
      return NextResponse.json({ error: `${message} You can paste the text of the message instead.` }, { status: 422 });
    }
  }

  if (text.trim().length < 15) {
    log({ error: "too-short" });
    return NextResponse.json(
      { error: "Text is too short. Enter at least 15 characters to analyze." },
      { status: 422 },
    );
  }
  if (text.length > MAX_CHARS) {
    log({ error: "too-long" });
    return NextResponse.json(
      { error: `Text is too long. Paste at most ${MAX_CHARS.toLocaleString("en-US")} characters.` },
      { status: 413 },
    );
  }

  try {
    // The archive lookup does not depend on the model, so a slow or failing lookup never hides the verdict.
    const [result, related] = await Promise.all([
      runDetection(text),
      // A web page carries menus and comments; its title and opening say what the claim is.
      findSimilarArticles(source ? `${source.title}\n${text.slice(0, 1000)}` : text, 4).catch((err) => {
        console.error("[detect] archive lookup failed:", err);
        return [];
      }),
    ]);
    const final = withArchiveVerdict(result, related);
    // Feeds the admin dashboard's search statistics (text and verdict); the full record is in the research log above.
    try {
      recordSearch(link ?? text, final.verdict);
    } catch (err) {
      console.error("[detect] could not record search:", err);
    }
    const checkId = log({
      url: link ?? "", pageTitle: source?.title ?? "", lang: final.language, verdict: final.verdict,
      probability: final.hoaxProbability, engine: final.engine, matches: related.length, topMatch: related[0]?.slug ?? "",
    });
    return NextResponse.json({ ...final, related, checkId, ...(source ? { source } : {}) });
  } catch (err) {
    console.error("[detect] failed:", err);
    log({ error: "failed" });
    return NextResponse.json(
      { error: "Failed to analyze the text. Please try again shortly." },
      { status: 502 },
    );
  }
}
