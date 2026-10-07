import { describe, expect, it } from "vitest";
import type { Article } from "@/lib/data";
import { breadcrumbJsonLd, claimReviewJsonLd, hasOwnText, serializeJsonLd, stripLeadingTag } from "@/lib/structured-data";
import { SITE_URL } from "@/lib/site";

const article = (extra: Partial<Article> = {}): Article => ({
  slug: "vaksin-magnet",
  title: "[SALAH] Setelah Divaksin, Tubuh Punya Daya Magnetis",
  lang: "id",
  category: "Hoax",
  verdict: "hoax",
  date: "2021-05-01",
  summaryId: "",
  summaryEn: "",
  source: "",
  narration: "“Setelah divaksin,   lengan jadi magnet.”",
  explanation: "Vaksin tidak mengandung logam.",
  reference: "",
  image: "",
  originalUrl: "https://turnbackhoax.id/2021/05/01/salah-vaksin-magnet/",
  sourceSite: "turnbackhoax.id",
  ...extra,
});

describe("stripLeadingTag", () => {
  it("drops the fact-checker's bracket tag", () => {
    expect(stripLeadingTag("[SALAH] Vaksin membuat tubuh magnetis")).toBe("Vaksin membuat tubuh magnetis");
    expect(stripLeadingTag("(HOAKS): Nomor Porsi Haji")).toBe("Nomor Porsi Haji");
    expect(stripLeadingTag("False Rumours Claim Facebook Will Charge")).toBe("False Rumours Claim Facebook Will Charge");
  });

  it("keeps a title that is only a tag", () => {
    expect(stripLeadingTag("[SALAH]")).toBe("[SALAH]");
  });
});

describe("claimReviewJsonLd", () => {
  it("describes the fact-check with its publisher, claim, original link and rating", () => {
    const ld = claimReviewJsonLd(article());
    expect(ld).toMatchObject({
      "@context": "https://schema.org",
      "@type": "ClaimReview",
      url: `${SITE_URL}/blog/vaksin-magnet`,
      claimReviewed: "“Setelah divaksin, lengan jadi magnet.”",
      datePublished: "2021-05-01",
      inLanguage: "id",
      author: { "@type": "Organization", name: "TurnBackHoax (MAFINDO)", url: "https://turnbackhoax.id/2021/05/01/salah-vaksin-magnet/" },
      itemReviewed: { "@type": "Claim", appearance: { "@type": "CreativeWork", url: "https://turnbackhoax.id/2021/05/01/salah-vaksin-magnet/" } },
      reviewRating: { "@type": "Rating", ratingValue: 1, bestRating: 5, worstRating: 1, alternateName: "Hoax" },
    });
  });

  it("falls back to the untagged title as the claim and to the site as the author", () => {
    const ld = claimReviewJsonLd(article({ narration: "", originalUrl: undefined, sourceSite: undefined, verdict: "valid", date: "" }));
    expect(ld.claimReviewed).toBe("Setelah Divaksin, Tubuh Punya Daya Magnetis");
    expect(ld.author).toEqual({ "@type": "Organization", name: "Hoax Detection & Analyzer", url: SITE_URL });
    expect(ld.itemReviewed).toEqual({ "@type": "Claim" });
    expect(ld).not.toHaveProperty("datePublished");
    expect((ld.reviewRating as { ratingValue: number; alternateName: string }).ratingValue).toBe(5);
    expect((ld.reviewRating as { alternateName: string }).alternateName).toBe("Credible");
    expect((claimReviewJsonLd(article({ verdict: "misleading" })).reviewRating as { ratingValue: number }).ratingValue).toBe(3);
  });
});

describe("breadcrumbJsonLd", () => {
  it("walks Home → Archive → article", () => {
    const ld = breadcrumbJsonLd(article());
    expect(ld["@type"]).toBe("BreadcrumbList");
    expect(ld.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: "Archive", item: `${SITE_URL}/blog` },
      { "@type": "ListItem", position: 3, name: "[SALAH] Setelah Divaksin, Tubuh Punya Daya Magnetis", item: `${SITE_URL}/blog/vaksin-magnet` },
    ]);
  });
});

describe("serializeJsonLd", () => {
  it("cannot close the script tag early", () => {
    const json = serializeJsonLd(claimReviewJsonLd(article({ title: "</script><script>alert(1)</script>", narration: "" })));
    expect(json).not.toContain("<");
    expect(json).toContain("\\u003c/script>");
    expect(JSON.parse(json).claimReviewed).toBe("</script><script>alert(1)</script>");
  });
});

describe("hasOwnText", () => {
  it("tells link-only entries apart", () => {
    expect(hasOwnText({ explanation: "", narration: "" })).toBe(false);
    expect(hasOwnText({ explanation: "", narration: "a claim" })).toBe(true);
  });
});
