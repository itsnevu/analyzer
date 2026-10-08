import { NextResponse } from "next/server";
import { logAdmin } from "@/lib/admin-log";
import { isAdmin } from "@/lib/admin-articles";
import { addStopwords, countStopwords, isSettingLang, listStopwords } from "@/lib/settings";
import { adminTFromRequest } from "@/lib/admin-lang";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A page of one language's stopwords: ?lang=id&q=&page=1 */
export async function GET(req: Request) {
  const t = adminTFromRequest(req);
  if (!(await isAdmin())) return NextResponse.json({ error: t("Unauthorized") }, { status: 401 });
  const p = new URL(req.url).searchParams;
  const lang = p.get("lang");
  if (!isSettingLang(lang)) return NextResponse.json({ error: t("Choose one of the listed languages.") }, { status: 422 });
  return NextResponse.json({ ...listStopwords(lang, p.get("q") ?? "", Number(p.get("page")) || 1), counts: countStopwords() });
}

/** Adds words: { lang, words: "a, b\nc" | ["a", "b"] } */
export async function POST(req: Request) {
  const t = adminTFromRequest(req);
  if (!(await isAdmin())) return NextResponse.json({ error: t("Unauthorized") }, { status: 401 });
  let body: { lang?: unknown; words?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: t("The request could not be read. Reload the page and try again.") }, { status: 400 });
  }
  if (!isSettingLang(body.lang)) return NextResponse.json({ error: t("Choose one of the listed languages.") }, { status: 422 });
  const words = Array.isArray(body.words)
    ? body.words.filter((w): w is string => typeof w === "string")
    : typeof body.words === "string"
      ? body.words.split(/[,\n;]+/)
      : [];
  if (!words.length) return NextResponse.json({ error: t("Enter at least one word.") }, { status: 422 });
  const added = addStopwords(body.lang, words.slice(0, 5000));
  logAdmin(req, "settings.stopwords", body.lang, `${added} added`);
  return NextResponse.json({ ok: true, added, counts: countStopwords() });
}
