import zlib from "node:zlib";
import { describe, expect, it } from "vitest";
import {
  captureRecordUrl,
  crawlDate,
  crawlIdOf,
  crawlsBetween,
  decodeBody,
  dechunk,
  groupCaptures,
  latestCaptures,
  normalizeUrl,
  parseCdxLines,
  rangeOf,
  splitWarcRecord,
  type CdxRecord,
} from "@/lib/commoncrawl";

describe("normalizeUrl", () => {
  it.each([
    ["https://stophoax.id/blog/post/hoaks-x", "stophoax.id/blog/post/hoaks-x"],
    ["http://www.stophoax.id/blog/post/hoaks-x/", "stophoax.id/blog/post/hoaks-x"],
    ["HTTPS://WWW.StopHoax.ID/blog/post/Hoaks-X?utm_source=fb#top", "stophoax.id/blog/post/Hoaks-X"],
    ["stophoax.id/blog/post/hoaks-x//", "stophoax.id/blog/post/hoaks-x"],
    ["https://stophoax.id/blog/post/salah-%E2%80%9Cvaksin%E2%80%9D", "stophoax.id/blog/post/salah-“vaksin”"],
    ["https://stophoax.id/", "stophoax.id"],
  ])("%s → %s", (input, expected) => {
    expect(normalizeUrl(input)).toBe(expected);
  });
});

describe("crawl selection", () => {
  it("reads the start date from collinfo or from the ISO week in the id", () => {
    expect(crawlDate({ id: "CC-MAIN-2021-10", from: "2021-02-24T05:40:00" })).toBe("2021-02-24");
    expect(crawlDate({ id: "CC-MAIN-2021-10" })).toBe("2021-03-08");
    expect(crawlDate({ id: "CC-MAIN-2018-05" })).toBe("2018-01-29");
    expect(crawlDate({ id: "odd" })).toBe("");
  });

  it("keeps the crawls inside the window, oldest first", () => {
    const crawls = [
      { id: "CC-MAIN-2023-06", from: "2023-01-26T00:00:00" },
      { id: "CC-MAIN-2022-49", from: "2022-11-26T00:00:00" },
      { id: "CC-MAIN-2019-13", from: "2019-03-18T00:00:00" },
      { id: "CC-MAIN-2017-51" },
      { id: "CC-MAIN-2018-05" },
    ];
    expect(crawlsBetween(crawls, "2018-01", "2022-12")).toEqual(["CC-MAIN-2018-05", "CC-MAIN-2019-13", "CC-MAIN-2022-49"]);
  });
});

describe("index records", () => {
  const rec = (url: string, timestamp: string, status = "200", mime = "text/html"): CdxRecord => ({
    url,
    timestamp,
    status,
    mime,
    "mime-detected": mime,
    filename: "crawl-data/CC-MAIN-2020-16/segments/1/warc/CC-MAIN-x-00509.warc.gz",
    offset: "100",
    length: "50",
  });

  it("parses JSON lines and ignores junk", () => {
    const text = `${JSON.stringify(rec("https://stophoax.id/blog/post/a", "20200330213651"))}\n\n<html>502</html>\n{"broken`;
    expect(parseCdxLines(text).map((r) => r.url)).toEqual(["https://stophoax.id/blog/post/a"]);
  });

  it("groups the successful HTML captures of a page, newest first", () => {
    const records = [
      rec("https://stophoax.id/blog/post/a", "20190101000000"),
      rec("http://www.stophoax.id/blog/post/a/", "20200101000000"),
      rec("http://www.stophoax.id/blog/post/a/", "20200101000000"),
      rec("https://stophoax.id/blog/post/a", "20210101000000", "301"),
      rec("https://stophoax.id/blog/post/a", "20210201000000", "200", "application/pdf"),
      rec("https://stophoax.id/blog/post/b", "20190101000000"),
    ];
    const groups = groupCaptures(records);
    expect([...groups.keys()].sort()).toEqual(["stophoax.id/blog/post/a", "stophoax.id/blog/post/b"]);
    expect(groups.get("stophoax.id/blog/post/a")?.map((r) => r.timestamp)).toEqual(["20200101000000", "20190101000000"]);
    expect(latestCaptures(records).get("stophoax.id/blog/post/a")?.timestamp).toBe("20200101000000");
  });

  it("derives the range, crawl id and record page from a record", () => {
    const r = rec("https://stophoax.id/blog/post/a", "20200330213651");
    expect(rangeOf(r)).toBe("bytes=100-149");
    expect(crawlIdOf(r.filename)).toBe("CC-MAIN-2020-16");
    expect(captureRecordUrl("CC-MAIN-2020-16", "https://stophoax.id/blog/post/a")).toBe(
      "https://index.commoncrawl.org/CC-MAIN-2020-16-index?url=https%3A%2F%2Fstophoax.id%2Fblog%2Fpost%2Fa&output=json",
    );
  });
});

describe("splitWarcRecord", () => {
  const html = "<html><head><meta charset=\"utf-8\"></head><body><p>Halo “dunia”</p></body></html>";
  const build = (httpBlock: Buffer, eol = "\r\n") => {
    const warc = [
      "WARC/1.0",
      "WARC-Type: response",
      "WARC-Target-URI: https://stophoax.id/blog/post/a",
      `Content-Length: ${httpBlock.length}`,
      "Content-Type: application/http; msgtype=response",
      "",
      "",
    ].join(eol);
    return Buffer.concat([Buffer.from(warc, "utf8"), httpBlock, Buffer.from(`${eol}${eol}`)]);
  };
  const http = (headers: string[], body: Buffer) => Buffer.concat([Buffer.from([...headers, "", ""].join("\r\n"), "latin1"), body]);

  it("separates WARC headers, HTTP headers and the body", () => {
    const body = Buffer.from(html, "utf8");
    const rec = splitWarcRecord(build(http(["HTTP/1.1 200 OK", "Content-Type: text/html; charset=UTF-8", "Server: Apache"], body)));
    expect(rec.warcHeaders["warc-target-uri"]).toBe("https://stophoax.id/blog/post/a");
    expect(rec.status).toBe(200);
    expect(rec.httpHeaders["content-type"]).toBe("text/html; charset=UTF-8");
    expect(rec.body.equals(body)).toBe(true);
    expect(decodeBody(rec.body, rec.httpHeaders["content-type"])).toBe(html);
  });

  it("copes with a record that uses bare LF line ends", () => {
    const body = Buffer.from("<p>x</p>");
    const rec = splitWarcRecord(build(http(["HTTP/1.1 404 Not Found"], body), "\n"));
    expect(rec.status).toBe(404);
    expect(rec.body.toString()).toBe("<p>x</p>");
  });

  it("undoes chunked and gzipped bodies", () => {
    const chunked = Buffer.from("5\r\n<p>Ha\r\n6\r\nlo</p>\r\n0\r\n\r\n");
    expect(dechunk(chunked).toString()).toBe("<p>Halo</p>");
    const rec = splitWarcRecord(build(http(["HTTP/1.1 200 OK", "Transfer-Encoding: chunked"], chunked)));
    expect(rec.body.toString()).toBe("<p>Halo</p>");
    const gz = zlib.gzipSync(Buffer.from(html));
    const rec2 = splitWarcRecord(build(http(["HTTP/1.1 200 OK", "Content-Encoding: gzip"], gz)));
    expect(rec2.body.toString()).toBe(html);
  });

  it("rejects something that is not a WARC record", () => {
    expect(() => splitWarcRecord(Buffer.from("<html>502 Bad Gateway</html>"))).toThrow(/not a WARC record/);
  });
});

describe("decodeBody", () => {
  it("uses the charset from the header, then the page, then UTF-8", () => {
    const latin = Buffer.from("caf\xe9", "latin1");
    expect(decodeBody(latin, "text/html; charset=ISO-8859-1")).toBe("café");
    const metaOnly = Buffer.concat([Buffer.from('<meta http-equiv="Content-Type" content="text/html; charset=windows-1252">'), latin]);
    expect(decodeBody(metaOnly, "text/html")).toContain("café");
    expect(decodeBody(Buffer.from("“ok”", "utf8"))).toBe("“ok”");
  });

  it("falls back to UTF-8 for an unknown charset", () => {
    expect(decodeBody(Buffer.from("ok"), "text/html; charset=x-nonsense")).toBe("ok");
  });
});
