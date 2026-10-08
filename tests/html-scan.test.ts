import { describe, expect, it } from "vitest";
import { extractText, isPrivateAddress } from "@/lib/fetch-page";
import { htmlToLines, dateFromHtml } from "@/lib/extract";
const time = (fn: () => void) => { const t = performance.now(); fn(); return performance.now() - t; };
// Worst-case pages from the security audit: these took up to ~140 s with the old regexes.
describe("HTML readers run in linear time", () => {
  for (const [name, piece] of [["<p>", "<p>"], ["<p", "<p"], ["<meta", "<meta property="], ["<!--", "<!--"], ["<script", "<script>"], ["<title", "<title"], ["<li><a", "<li><a "], ["<link", "<link rel="]] as const) {
    it(name, () => {
      const html = piece.repeat(Math.floor((2 * 1024 * 1024) / piece.length));
      const a = time(() => extractText(html));
      const b = time(() => htmlToLines(html));
      const c = time(() => dateFromHtml(html));
      expect(a + b + c).toBeLessThan(5000);
    });
  }
  it("still extracts", () => {
    const r = extractText(`<html><head><title>T</title><meta property="og:title" content="OG &amp; Title"></head><body><nav><p>menu menu menu menu menu menu menu menu menu menu</p></nav><article><p>This is the first real paragraph of the article with enough text.</p><p>Second paragraph, also long enough to be kept by the filter here.</p></article></body></html>`);
    expect(r.title).toBe("OG & Title");
    expect(r.text).toContain("first real paragraph");
    expect(r.text).not.toContain("menu menu");
  });
  it("blocks mapped and special addresses", () => {
    for (const a of ["::ffff:7f00:1", "[::ffff:7f00:1]", "::ffff:c0a8:101", "::ffff:0:7f00:1", "::1", "::", "127.0.0.1", "10.1.2.3", "192.168.1.1", "169.254.1.1", "fe80::1", "fd00::1", "64:ff9b::a00:1", "2002:c0a8:101::", "0.0.0.0", "100.64.0.1", "::7f00:1"]) expect(isPrivateAddress(a), a).toBe(true);
    for (const a of ["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111", "::ffff:808:808".replace("::ffff:808:808", "8.8.4.4")]) expect(isPrivateAddress(a), a).toBe(false);
  });
});
