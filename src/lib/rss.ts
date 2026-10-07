/** Helpers for the RSS feed (see src/app/feed.xml/route.ts). Pure functions, safe to test on their own. */

/** Escapes text for an XML element or attribute value. Control characters XML cannot carry are dropped. */
export function escapeXml(s: string): string {
  return s
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** "2021-05-01" as an RFC 822 date (midnight UTC), the format RSS asks for; "" for anything else. */
export function rfc822Date(date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "";
  const d = new Date(`${date}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? "" : d.toUTCString();
}

export interface FeedItem {
  title: string;
  link: string;
  description: string;
  category: string;
  /** YYYY-MM-DD */
  date: string;
  /** Name of the site that published the fact-check, if any. */
  sourceName?: string;
  sourceUrl?: string;
}

export interface FeedChannel {
  title: string;
  link: string;
  description: string;
  /** Absolute URL of the feed itself, for atom:link rel="self". */
  self: string;
  language: string;
}

/** An RSS 2.0 document. Every string is escaped here, so callers pass plain text. */
export function buildRss(channel: FeedChannel, items: FeedItem[]): string {
  const entries = items
    .map((item) => {
      const pubDate = rfc822Date(item.date);
      const source = item.sourceName ? `<source url="${escapeXml(item.sourceUrl ?? item.link)}">${escapeXml(item.sourceName)}</source>` : "";
      return [
        "    <item>",
        `      <title>${escapeXml(item.title)}</title>`,
        `      <link>${escapeXml(item.link)}</link>`,
        `      <guid isPermaLink="true">${escapeXml(item.link)}</guid>`,
        pubDate ? `      <pubDate>${pubDate}</pubDate>` : "",
        `      <category>${escapeXml(item.category)}</category>`,
        `      <description>${escapeXml(item.description)}</description>`,
        source ? `      ${source}` : "",
        "    </item>",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    `    <title>${escapeXml(channel.title)}</title>`,
    `    <link>${escapeXml(channel.link)}</link>`,
    `    <description>${escapeXml(channel.description)}</description>`,
    `    <language>${escapeXml(channel.language)}</language>`,
    `    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>`,
    `    <atom:link href="${escapeXml(channel.self)}" rel="self" type="application/rss+xml" />`,
    entries,
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");
}
