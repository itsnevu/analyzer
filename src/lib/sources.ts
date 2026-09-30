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

/** "2019-04-06" → "Apr 6, 2019"; "" or junk → "". Pinned to UTC so server and browser agree. */
export function formatDate(date: string, style: "short" | "long" = "short"): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "";
  const d = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { day: "numeric", month: style === "long" ? "long" : "short", year: "numeric", timeZone: "UTC" });
}

export function formatCount(n: number): string {
  return n.toLocaleString("en-US");
}
