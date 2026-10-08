/**
 * Cross-site request checks for state-changing admin requests. The session
 * cookie is SameSite=Lax, which already keeps other sites' POSTs from carrying
 * it; this also refuses requests from sibling subdomains ("same-site") and
 * from browsers that send no Sec-Fetch-Site but a foreign Origin.
 */

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function hostOf(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).host.toLowerCase();
  } catch {
    return null;
  }
}

/** Hosts this site answers on: the request's own Host (as the proxy forwarded it) and SITE_URL. */
function ownHosts(req: { headers: Headers }): Set<string> {
  const hosts = new Set<string>();
  for (const h of [req.headers.get("x-forwarded-host"), req.headers.get("host")]) {
    for (const part of (h ?? "").split(",")) if (part.trim()) hosts.add(part.trim().toLowerCase());
  }
  const site = hostOf(process.env.SITE_URL);
  if (site) hosts.add(site);
  return hosts;
}

/** True when a write (anything but GET/HEAD/OPTIONS) did not come from this site's own pages. */
export function isCrossSiteWrite(req: { method: string; headers: Headers }): boolean {
  if (SAFE_METHODS.has(req.method.toUpperCase())) return false;
  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite) return fetchSite !== "same-origin" && fetchSite !== "none";
  const origin = req.headers.get("origin");
  // No Origin and no Sec-Fetch-Site: not a browser form or fetch from another page (e.g. curl, scripts).
  if (!origin) return false;
  const host = hostOf(origin);
  return !host || !ownHosts(req).has(host);
}
