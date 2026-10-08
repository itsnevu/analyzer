import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-articles";
import { baselineAvailable, predictBaseline } from "@/lib/baseline";
import { adminTFromRequest } from "@/lib/admin-lang";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CHARS = 20_000;

/** The baseline's own answer for a text, with probabilities and cues. Admins only; nothing is logged. */
export async function POST(req: Request) {
  const t = adminTFromRequest(req);
  if (!(await isAdmin())) return NextResponse.json({ error: t("Unauthorized") }, { status: 401 });
  let body: { text?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: t("The request could not be read. Reload the page and try again.") }, { status: 400 });
  }
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (text.length < 3) return NextResponse.json({ error: t("Type or paste some text to check.") }, { status: 422 });
  if (text.length > MAX_CHARS) return NextResponse.json({ error: t("Paste at most {max} characters.", { max: MAX_CHARS }) }, { status: 413 });
  if (!baselineAvailable()) return NextResponse.json({ error: t("There is no trained model yet. Train the model first.") }, { status: 409 });

  const started = performance.now();
  const prediction = predictBaseline(text, 12);
  const ms = Math.round((performance.now() - started) * 100) / 100;
  if (!prediction) return NextResponse.json({ error: t("The model knows none of the words in this text, so it gives no verdict (the keyword heuristic answers instead).") }, { status: 422 });
  return NextResponse.json({ ...prediction, ms });
}
