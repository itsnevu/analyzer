/** Display names for the fact-checking sites the archive was collected from. Safe for client code. */
const SOURCE_NAMES: Record<string, string> = {
  "turnbackhoax.id": "TurnBackHoax (MAFINDO)",
  "kominfo.go.id": "Kominfo",
  "stophoax.id": "Stophoax.id",
  "cekfakta.com": "CekFakta.com",
  "cekfakta.tempo.co": "Tempo Cek Fakta",
  "kompas.com": "Kompas.com",
  "liputan6.com": "Liputan6 Cek Fakta",
  "hoax-slayer.com": "Hoax-Slayer",
  "truthorfiction.com": "Truth or Fiction",
  "sophos.com": "Sophos",
  "covid19.go.id": "Satgas COVID-19 Hoax Buster",
  "saberhoaks.jabarprov.go.id": "Jabar Saber Hoaks",
  "tribunnews.com": "Tribunnews",
};

export function sourceName(site: string): string {
  return SOURCE_NAMES[site] ?? site;
}

// Sources whose old article links no longer lead to the article (checked October 2026).
const GONE: RegExp[] = [
  /^https?:\/\/(www\.)?stophoax\.id\//i, // domain is parked and for sale
  /^https?:\/\/(www\.)?turnbackhoax\.id\/\d{4}\/\d{2}\/\d{2}\//i, // old WordPress permalinks, 404 since the site moved
  /^https?:\/\/(www\.)?hoax-slayer\.(net|com)\//i, // offline
  /^https?:\/\/(www\.)?kominfo\.go\.id\//i, // unreachable since the ministry became Komdigi
  /^https?:\/\/(www\.)?sophos\.com\/+en-us\/threat-center\//i, // section removed
  /^https?:\/\/jabarsaberhoaks\.jabarprov\.go\.id\//i, // old domain offline
];

export function isGone(url: string): boolean {
  return GONE.some((re) => re.test(url));
}

/** Internet Archive copy of `url` closest to `date` (YYYY-MM-DD), i.e. from before the site went away. */
export function archiveCopy(url: string, date?: string): string {
  const stamp = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.replace(/-/g, "") : "2019";
  return `https://web.archive.org/web/${stamp}/${url}`;
}

/** Where a link to a source should point: the original, or its archived copy when the original is gone. */
export function outboundLink(url: string, date?: string, archiveUrl?: string): { href: string; archived: boolean } {
  if (archiveUrl) return { href: archiveUrl, archived: true };
  if (isGone(url)) return { href: archiveCopy(url, date), archived: true };
  return { href: url, archived: false };
}

/** Hostname of a URL without "www.", or "" when it is not a URL. */
export function hostOf(url: string | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export const LANGUAGE_NAME: Record<"id" | "en", string> = { id: "Indonesian", en: "English" };

/** "2019-04-06" → "Apr 6, 2019" (or "6 Apr 2019" for "id"); "" or junk → "". Pinned to UTC so server and browser agree. */
export function formatDate(date: string, style: "short" | "long" = "short", lang: "en" | "id" = "en"): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "";
  const d = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(lang === "id" ? "id-ID" : "en-US", { day: "numeric", month: style === "long" ? "long" : "short", year: "numeric", timeZone: "UTC" });
}

export function formatCount(n: number, lang: "en" | "id" = "en"): string {
  return n.toLocaleString(lang === "id" ? "id-ID" : "en-US");
}
