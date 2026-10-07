import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-articles";
import { baselineAvailable, predictBaseline } from "@/lib/baseline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CHARS = 20_000;

/** The baseline's own answer for a text, with probabilities and cues. Admins only; nothing is logged. */
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: { text?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (text.length < 3) return NextResponse.json({ error: "Enter some text to classify." }, { status: 422 });
  if (text.length > MAX_CHARS) return NextResponse.json({ error: `Paste at most ${MAX_CHARS.toLocaleString("en-US")} characters.` }, { status: 413 });
  if (!baselineAvailable()) return NextResponse.json({ error: "No baseline model file. Train one first." }, { status: 409 });

  const started = performance.now();
  const prediction = predictBaseline(text, 12);
  const ms = Math.round((performance.now() - started) * 100) / 100;
  if (!prediction) return NextResponse.json({ error: "The model knows none of the words in this text, so it gives no verdict (the keyword heuristic answers instead)." }, { status: 422 });
  return NextResponse.json({ ...prediction, ms });
}
