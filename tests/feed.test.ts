import { describe, expect, it } from "vitest";
import { buildRss, escapeXml, rfc822Date } from "@/lib/rss";

describe("escapeXml", () => {
  it("escapes the five XML characters", () => {
    expect(escapeXml(`Tom & Jerry <b>"say"</b> 'hi'`)).toBe("Tom &amp; Jerry &lt;b&gt;&quot;say&quot;&lt;/b&gt; &apos;hi&apos;");
  });

  it("keeps text that is already safe, including non-ASCII", () => {
    expect(escapeXml("[SALAH] “Vaksin” — hoaks")).toBe("[SALAH] “Vaksin” — hoaks");
  });

  it("drops control characters XML cannot carry", () => {
    expect(escapeXml("a\u0000b\u0007c\td\ne")).toBe("abc\td\ne");
  });
});

describe("rfc822Date", () => {
  it("formats an ISO day as an RFC 822 date at midnight UTC", () => {
    expect(rfc822Date("2021-05-01")).toBe("Sat, 01 May 2021 00:00:00 GMT");
  });

  it("returns an empty string for junk", () => {
    expect(rfc822Date("")).toBe("");
    expect(rfc822Date("2021-13-45")).toBe("");
    expect(rfc822Date("yesterday")).toBe("");
  });
});

describe("buildRss", () => {
  it("writes a well-formed RSS 2.0 document with a self link", () => {
    const xml = buildRss(
      { title: "Feed <1>", link: "https://example.com/blog", description: "Latest & greatest", self: "https://example.com/feed.xml", language: "id" },
      [
        {
          title: "[SALAH] A & B",
          link: "https://example.com/blog/a-b",
          description: "Claim <x> is false.",
          category: "Hoax",
          date: "2021-05-01",
          sourceName: "TurnBackHoax (MAFINDO)",
          sourceUrl: "https://turnbackhoax.id/",
        },
        { title: "No date", link: "https://example.com/blog/no-date", description: "", category: "Credible", date: "" },
      ],
    );
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<atom:link href="https://example.com/feed.xml" rel="self" type="application/rss+xml" />');
    expect(xml).toContain("<title>Feed &lt;1&gt;</title>");
    expect(xml).toContain("<title>[SALAH] A &amp; B</title>");
    expect(xml).toContain('<guid isPermaLink="true">https://example.com/blog/a-b</guid>');
    expect(xml).toContain("<pubDate>Sat, 01 May 2021 00:00:00 GMT</pubDate>");
    expect(xml).toContain("<category>Hoax</category>");
    expect(xml).toContain("<description>Claim &lt;x&gt; is false.</description>");
    expect(xml).toContain('<source url="https://turnbackhoax.id/">TurnBackHoax (MAFINDO)</source>');
    // An item without a date or a source leaves those elements out instead of writing empty ones.
    const second = xml.slice(xml.indexOf("No date"));
    expect(second).not.toContain("<pubDate>");
    expect(second).not.toContain("<source");
    expect((xml.match(/<item>/g) ?? []).length).toBe(2);
  });
});
