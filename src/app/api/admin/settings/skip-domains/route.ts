import { NextResponse } from "next/server";
import { logAdmin } from "@/lib/admin-log";
import { isAdmin } from "@/lib/admin-articles";
import { addSkipDomain, listSkipDomains } from "@/lib/settings";
import { adminTFromRequest } from "@/lib/admin-lang";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const t = adminTFromRequest(req);
  if (!(await isAdmin())) return NextResponse.json({ error: t("Unauthorized") }, { status: 401 });
  return NextResponse.json({ domains: listSkipDomains() });
}

/** Adds a domain: { domain: "example.com" | "https://www.example.com/page", note? } */
export async function POST(req: Request) {
  const t = adminTFromRequest(req);
  if (!(await isAdmin())) return NextResponse.json({ error: t("Unauthorized") }, { status: 401 });
  let body: { domain?: unknown; note?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: t("The request could not be read. Reload the page and try again.") }, { status: 400 });
  }
  const domain = typeof body.domain === "string" ? body.domain : "";
  if (!domain.trim()) return NextResponse.json({ error: t("Enter a domain, for example example.com.") }, { status: 422 });
  const added = addSkipDomain(domain, typeof body.note === "string" ? body.note : "");
  if (!added) {
    const exists = listSkipDomains().some((d) => d.domain === domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, ""));
    return NextResponse.json({ error: exists ? t("That domain is already on the list.") : t("That is not a valid domain. Enter it like example.com.") }, { status: exists ? 409 : 422 });
  }
  logAdmin(req, "settings.skip-domains", domain.trim(), "added");
  return NextResponse.json({ ok: true, domains: listSkipDomains() });
}
