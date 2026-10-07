import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

// A throwaway database for this file; set before the store is loaded.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hoax-extract-"));
process.env.DATABASE_PATH = path.join(dir, "test.db");

const extract = await import("@/lib/extract");
const store = await import("@/lib/articles");
const { getDb } = await import("@/lib/db");

const TURNBACKHOAX_HTML = `<!doctype html><html><head>
<title>[SALAH] Vaksin COVID-19 Mengandung Microchip Pelacak - TurnBackHoax</title>
<meta property="og:title" content="[SALAH] Vaksin COVID-19 Mengandung Microchip Pelacak - TurnBackHoax">
<meta property="og:url" content="https://turnbackhoax.id/2021/01/12/salah-vaksin-covid-19-mengandung-microchip-pelacak/">
<meta property="article:published_time" content="2021-01-12T09:30:00+07:00">
<script>window.x = 1;</script>
</head><body>
<nav><a href="/">Home</a> <a href="/about">Tentang</a></nav>
<article>
<h1>[SALAH] Vaksin COVID-19 Mengandung Microchip Pelacak</h1>
<p class="meta">12 Januari 2021</p>
<p>Beredar pesan berantai di WhatsApp yang menyebut vaksin COVID-19 mengandung microchip untuk melacak penerimanya. Faktanya, klaim tersebut tidak benar.</p>
<p><strong>SUMBER:</strong> WhatsApp</p>
<p><strong>NARASI:</strong></p>
<p>&ldquo;Hati-hati, vaksin COVID-19 berisi microchip yang bisa melacak keberadaan kita. Sebarkan ke keluarga!&rdquo;</p>
<p><strong>PENJELASAN:</strong></p>
<p>Juru bicara Kementerian Kesehatan menegaskan vaksin tidak mengandung microchip. Ukuran jarum suntik tidak memungkinkan microchip pelacak masuk ke tubuh.</p>
<p>Klaim serupa pernah dibantah oleh WHO pada tahun 2020. Dengan demikian, klaim tersebut termasuk konten yang menyesatkan.</p>
<p><strong>REFERENSI:</strong></p>
<p><a href="https://www.kemkes.go.id/article/view/123">https://www.kemkes.go.id/article/view/123</a></p>
<p>https://www.who.int/news/item/covid-vaccine-myths</p>
<div class="share">Bagikan</div>
</article>
<footer>&copy; TurnBackHoax</footer>
</body></html>`;

const FORWARDED =
  "Assalamualaikum. Info penting dari grup sebelah!!! Mulai besok 1 Juli 2021 pemerintah akan menutup semua jalan tol di Jawa selama 2 minggu. " +
  "Siapkan kebutuhan pokok secukupnya. Sebarkan ke semua keluarga dan teman 🙏";

describe("a turnbackhoax-style page", () => {
  const lines = extract.htmlToLines(TURNBACKHOAX_HTML);
  const { fields, notes } = extract.parseFactCheck({
    text: lines.join("\n"),
    title: "[SALAH] Vaksin COVID-19 Mengandung Microchip Pelacak - TurnBackHoax",
    html: TURNBACKHOAX_HTML,
  });

  it("keeps the short heading lines a fact-check is parsed by", () => {
    expect(lines).toContain("NARASI:");
    expect(lines).toContain("PENJELASAN:");
    expect(lines).not.toContain("Home Tentang");
  });

  it("reads the title, label and site", () => {
    expect(fields.title).toBe("[SALAH] Vaksin COVID-19 Mengandung Microchip Pelacak");
    expect(fields.slug).toBe("salah-vaksin-covid-19-mengandung-microchip-pelacak");
    expect(fields).toMatchObject({ verdict: "hoax", category: "Hoax", verdictGuessed: false, verdictTag: "SALAH", lang: "id" });
    expect(fields.originalUrl).toBe("https://turnbackhoax.id/2021/01/12/salah-vaksin-covid-19-mengandung-microchip-pelacak/");
    expect(fields.sourceSite).toBe("turnbackhoax.id");
  });

  it("takes the date from the address first", () => {
    expect(fields.date).toBe("2021-01-12");
    expect(fields.dateFrom).toBe("url");
  });

  it("splits the sections", () => {
    expect(fields.source).toBe("WhatsApp");
    expect(fields.narration).toBe("“Hati-hati, vaksin COVID-19 berisi microchip yang bisa melacak keberadaan kita. Sebarkan ke keluarga!”");
    expect(fields.explanation.startsWith("Beredar pesan berantai")).toBe(true);
    expect(fields.explanation).toContain("Juru bicara Kementerian Kesehatan");
    expect(fields.explanation).not.toContain("REFERENSI");
    expect(fields.explanation).not.toContain("Bagikan");
    expect(fields.reference.split("\n")).toEqual(["https://www.kemkes.go.id/article/view/123", "https://www.who.int/news/item/covid-vaccine-myths"]);
  });

  it("summarises the explanation in two sentences", () => {
    expect(fields.summary).toBe(
      "Beredar pesan berantai di WhatsApp yang menyebut vaksin COVID-19 mengandung microchip untuk melacak penerimanya. Faktanya, klaim tersebut tidak benar.",
    );
    expect(fields.summary.length).toBeLessThanOrEqual(300);
    expect(notes).toEqual([]);
  });
});

describe("a forwarded message", () => {
  const { fields, notes } = extract.parseFactCheck({ text: FORWARDED });

  it("is filed as the narration, with a guessed verdict", () => {
    expect(fields.narration).toBe(FORWARDED);
    expect(fields.explanation).toBe("");
    expect(fields).toMatchObject({ verdict: "misleading", verdictGuessed: true, lang: "id", sourceSite: "", originalUrl: "" });
    expect(notes.some((n) => /narration/.test(n))).toBe(true);
    expect(notes.some((n) => /only a guess/.test(n))).toBe(true);
  });

  it("uses the opening words as the title and a date found in the text", () => {
    expect(fields.title.endsWith("…")).toBe(true);
    expect(fields.title.length).toBeLessThanOrEqual(101);
    expect(fields.date).toBe("2021-07-01");
    expect(fields.dateFrom).toBe("text");
  });

  it("falls back to today when the text has no date", () => {
    const { fields: f } = extract.parseFactCheck({ text: "Hati-hati vaksin microchip\nPesan singkat tanpa tanggal, sebarkan!" });
    expect(f.title).toBe("Hati-hati vaksin microchip");
    expect(f.date).toBe(new Date().toISOString().slice(0, 10));
    expect(f.dateFrom).toBe("today");
  });

  it("splits the old panel's inline headings", () => {
    const { fields: f } = extract.parseFactCheck({
      text: "[SALAH] Judul klaim NARASI: Ini klaimnya yang beredar luas. PENJELASAN: Ini penjelasannya dari pemeriksa fakta. REFERENSI: https://cekfakta.com/x",
    });
    expect(f.title).toBe("[SALAH] Judul klaim");
    expect(f.narration).toBe("Ini klaimnya yang beredar luas.");
    expect(f.explanation).toBe("Ini penjelasannya dari pemeriksa fakta.");
    expect(f.reference).toBe("https://cekfakta.com/x");
  });
});

describe("title tags", () => {
  it.each([
    ["[SALAH] Air rebusan sirsak menyembuhkan kanker", "hoax", "Hoax", "SALAH"],
    ["[HOAKS] Bakso tikus di pasar", "hoax", "Hoax", "HOAKS"],
    ["[HOAX] Free data from Telkomsel", "hoax", "Hoax", "HOAX"],
    ["[PENIPUAN] Undian berhadiah mobil", "hoax", "Hoax", "PENIPUAN"],
    ["[DISINFORMASI] Foto banjir Jakarta 2020", "misleading", "Disinformation", "DISINFORMASI"],
    ["[MISINFORMASI] Vaksin membuat tubuh magnet", "misleading", "Disinformation", "MISINFORMASI"],
    ["[SATIRE] Presiden ganti nama negara", "misleading", "Disinformation", "SATIRE"],
    ["[MISLEADING] Photo of the new bridge", "misleading", "Disinformation", "MISLEADING"],
    ["[KLARIFIKASI] Penutupan jalan tol", "valid", "Clarification", "KLARIFIKASI"],
    ["[FAKTA] Gempa Lombok 7 SR", "valid", "Verified", "FAKTA"],
    ["[BENAR] Pengumuman libur nasional", "valid", "Verified", "BENAR"],
    ["[TRUE] The vaccine is free", "valid", "Verified", "TRUE"],
    ["[Cek Fakta] [SALAH] Dua label", "hoax", "Hoax", "SALAH"],
    ["HOAKS: Label dengan titik dua", "hoax", "Hoax", "HOAKS"],
    ["Hoaks Bakso Tikus di Pasar Minggu", "hoax", "Hoax", "headline"],
    ["Video Tsunami di Palu Adalah Hoaks", "hoax", "Hoax", "headline"],
  ])("%s", (title, verdict, category, tag) => {
    expect(extract.verdictFromTitle(title)).toEqual({ verdict, category, guessed: false, tag });
  });

  it("guesses misleading when there is no label", () => {
    expect(extract.verdictFromTitle("Benarkah vaksin mengandung microchip?")).toMatchObject({ verdict: "misleading", guessed: true, tag: "" });
  });
});

describe("dates", () => {
  it("reads WordPress addresses", () => {
    expect(extract.dateFromUrl("https://turnbackhoax.id/2019/04/06/salah-x/")).toBe("2019-04-06");
    expect(extract.dateFromUrl("https://cekfakta.com/focus/1234")).toBe("");
  });

  it("reads page metadata", () => {
    expect(extract.dateFromHtml('<meta property="article:published_time" content="2020-05-03T10:00:00+07:00">')).toBe("2020-05-03");
    expect(extract.dateFromHtml('<script type="application/ld+json">{"@type":"NewsArticle","datePublished":"2022-11-30T08:00:00Z"}</script>')).toBe("2022-11-30");
    expect(extract.dateFromHtml("<p>nothing</p>")).toBe("");
  });

  it.each([
    ["Diunggah pada 28 Maret 2019 oleh admin", "2019-03-28"],
    ["Published March 28, 2019 at noon", "2019-03-28"],
    ["Posted Mar 5, 2021", "2021-03-05"],
    ["Tanggal publish: 28/03/2019", "2019-03-28"],
    ["Rilis 2019-03-28 pagi", "2019-03-28"],
    ["Pada 31 Februari 2019 (tidak valid) dan 1 Mei 2019", "2019-05-01"],
    ["tidak ada tanggal di sini", ""],
  ])("%s → %s", (text, expected) => {
    expect(extract.dateInText(text)).toBe(expected);
  });

  it("prefers the metadata over a date in the text, and the address over both", () => {
    const html = '<meta property="article:published_time" content="2020-05-03T10:00:00+07:00">';
    expect(extract.parseFactCheck({ text: "Judul\nDitulis 1 Juni 2020.\nIsi.", title: "Judul", html }).fields).toMatchObject({ date: "2020-05-03", dateFrom: "meta" });
    expect(extract.parseFactCheck({ text: "Judul\nDitulis 1 Juni 2020.\nIsi.", title: "Judul", html, url: "https://x.id/2020/04/01/judul/" }).fields).toMatchObject({
      date: "2020-04-01",
      dateFrom: "url",
    });
  });
});

describe("sites", () => {
  it.each([
    ["nasional.kompas.com", "kompas.com"],
    ["news.detik.com", "detik.com"],
    ["m.liputan6.com", "liputan6.com"],
    ["jateng.tribunnews.com", "tribunnews.com"],
    ["www.hoax-slayer.net", "hoax-slayer.com"],
    ["jabarsaberhoaks.jabarprov.go.id", "saberhoaks.jabarprov.go.id"],
    ["turnbackhoax.id", "turnbackhoax.id"],
    ["cekfakta.tempo.co", "cekfakta.tempo.co"],
  ])("groups %s as %s", (host, group) => {
    expect(extract.sourceGroup(host)).toBe(group);
  });

  it("reads the host of a link without www", () => {
    expect(extract.hostOf("https://www.Liputan6.com/cek-fakta/read/1")).toBe("liputan6.com");
    expect(extract.hostOf("not a link")).toBe("");
  });

  it.each([
    ["[SALAH] Slogan Bersatu - TurnBackHoax", "", "[SALAH] Slogan Bersatu"],
    ["[SALAH] Slogan Bersatu – Cek Fakta", "", "[SALAH] Slogan Bersatu"],
    ["Cek Fakta: Hoaks Bakso Tikus | Kompas.com", "", "Cek Fakta: Hoaks Bakso Tikus"],
    ["[SALAH] Klaim X - Hoax Buster | Covid19.go.id", "", "[SALAH] Klaim X"],
    ["Ants In The Brain Hoax - Hoax-Slayer", "hoax-slayer.com", "Ants In The Brain Hoax"],
    ["Judul Artikel - Tempo Cek Fakta", "cekfakta.tempo.co", "Judul Artikel"],
    ["Judul Artikel | Liputan6.com", "liputan6.com", "Judul Artikel"],
    ["Vaksin - Benarkah Begitu?", "turnbackhoax.id", "Vaksin - Benarkah Begitu?"],
  ])("strips the site suffix from %s", (title, host, expected) => {
    expect(extract.stripSiteSuffix(title, host)).toBe(expected);
  });
});

describe("summaries", () => {
  it("takes two sentences within 300 characters", () => {
    expect(extract.summarize("Satu. Dua. Tiga.")).toBe("Satu. Dua.");
    const long = `${"kata ".repeat(80).trim()}. Kedua.`;
    const s = extract.summarize(long);
    expect(s.length).toBeLessThanOrEqual(300);
    expect(s.endsWith("…")).toBe(true);
    expect(extract.summarize("")).toBe("");
  });
});

describe("extractArticle with the database", () => {
  it("parses pasted HTML and looks for duplicates", async () => {
    await store.saveArticle({
      slug: "microchip-lama",
      title: "[SALAH] Vaksin COVID-19 Berisi Microchip Pelacak Bill Gates",
      lang: "id",
      category: "Hoax",
      verdict: "hoax",
      date: "2020-12-01",
      summaryId: "",
      summaryEn: "",
      source: "",
      narration: "Vaksin COVID-19 berisi microchip yang melacak keberadaan penerimanya.",
      explanation: "Vaksin tidak mengandung microchip pelacak.",
      reference: "",
      image: "",
    });
    const r = await extract.extractArticle(TURNBACKHOAX_HTML);
    expect(r.kind).toBe("html");
    expect(r.fields.verdict).toBe("hoax");
    expect(r.fields.narration).toContain("microchip");
    expect(r.similar.map((a) => a.slug)).toContain("microchip-lama");
  });

  it("parses plain text", async () => {
    const r = await extract.extractArticle(FORWARDED);
    expect(r.kind).toBe("text");
    expect(r.fields.narration).toBe(FORWARDED);
    expect(r.source).toBeUndefined();
  });

  it("refuses empty input", async () => {
    await expect(extract.extractArticle("   ")).rejects.toBeInstanceOf(extract.ExtractError);
  });

  it("records the source site after a save", () => {
    expect(extract.setSourceSite("microchip-lama", "TurnBackHoax.id")).toBe(true);
    expect(getDb().prepare("SELECT sourceSite FROM articles WHERE slug = ?").get("microchip-lama")).toMatchObject({ sourceSite: "turnbackhoax.id" });
    expect(extract.setSourceSite("microchip-lama", "not a host!")).toBe(false);
    expect(extract.setSourceSite("no-such-slug", "a.id")).toBe(false);
  });
});
