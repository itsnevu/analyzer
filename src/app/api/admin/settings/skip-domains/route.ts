import { NextResponse } from "next/server";
import { logAdmin } from "@/lib/admin-log";
import { isAdmin } from "@/lib/admin-articles";
import { addSkipDomain, listSkipDomains } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ domains: listSkipDomains() });
}

/** Adds a domain: { domain: "example.com" | "https://www.example.com/page", note? } */
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: { domain?: unknown; note?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }
  const domain = typeof body.domain === "string" ? body.domain : "";
  if (!domain.trim()) return NextResponse.json({ error: "A hostname is required." }, { status: 422 });
  const added = addSkipDomain(domain, typeof body.note === "string" ? body.note : "");
  if (!added) {
    const exists = listSkipDomains().some((d) => d.domain === domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, ""));
    return NextResponse.json({ error: exists ? "That domain is already on the list." : "That is not a valid hostname." }, { status: exists ? 409 : 422 });
  }
  logAdmin(req, "settings.skip-domains", domain.trim(), "added");
  return NextResponse.json({ ok: true, domains: listSkipDomains() });
}
