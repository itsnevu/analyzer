import { describe, expect, it } from "vitest";
import { asSingleUrl, extractText, isPrivateAddress, readPage } from "@/lib/fetch-page";

describe("isPrivateAddress", () => {
  it.each(["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:192.168.0.1", "224.0.0.1"])(
    "refuses %s",
    (ip) => expect(isPrivateAddress(ip)).toBe(true),
  );
  it.each(["8.8.8.8", "93.184.216.34", "172.32.0.1", "2606:4700::1111"])("allows %s", (ip) => expect(isPrivateAddress(ip)).toBe(false));
});

describe("readPage refuses unsafe links before connecting", () => {
  it.each([
    ["http://127.0.0.1/", /not a public website/],
    ["http://[::1]/", /not a public website/],
    ["http://192.168.0.10/admin", /not a public website/],
    ["https://example.com:8443/", /standard web ports/],
    ["ftp://example.com/file", /Only http and https/],
    ["http://user:pw@example.com/", /user name or password/],
  ])("%s", async (url, message) => {
    await expect(readPage(url)).rejects.toThrow(message);
  });
});

describe("asSingleUrl", () => {
  it("accepts a lone link and nothing else", () => {
    expect(asSingleUrl("  https://example.com/a?b=1  ")).toBe("https://example.com/a?b=1");
    expect(asSingleUrl("lihat https://example.com")).toBeNull();
    expect(asSingleUrl("javascript:alert(1)")).toBeNull();
  });
});

describe("extractText", () => {
  it("prefers the article body and skips page chrome", () => {
    const html = `<html><head><title>Site title</title><meta property="og:title" content="Real headline"></head>
      <body><nav><p>Menu item that is long enough to count as a paragraph here.</p></nav>
      <article><p>First paragraph of the story with enough words in it to be kept by the extractor.</p>
      <p>Second paragraph, also long enough to be considered real article text by the rules.</p>${"<p>Filler sentence that makes the article long enough.</p>".repeat(8)}</article>
      <footer><p>Footer text that should never be part of the extracted article body at all.</p></footer></body></html>`;
    const { title, text } = extractText(html);
    expect(title).toBe("Real headline");
    expect(text).toContain("First paragraph");
    expect(text).not.toContain("Menu item");
    expect(text).not.toContain("Footer text");
  });
});
