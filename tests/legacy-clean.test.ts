import { describe, expect, it } from "vitest";
import { cleanDatasetRow, cleanPost, cleanTitle, datasetResult, fixMojibake, parseLooseDate } from "../scripts/legacy-clean";

describe("parseLooseDate", () => {
  it.each([
    ["Februari18,2022", "2022-02-18"],
    ["May18,2017", "2017-05-18"],
    ["Selasa,21Mei201916:12WIB", "2019-05-21"],
    ["31Jul2021", "2021-07-31"],
    ["01Agu2021", "2021-08-01"],
    ["Sumber: Youtube.com Tanggalpublish:13/12/2021", "2021-12-13"],
    ["Kompas.com-20/09/2020,12:04WIB", "2020-09-20"],
    ["Lipstick Category: Chainletter DiscoveredOn: 08Mar2006 Type: chain", "2006-03-08"],
    ["ByKominfo Apr24,2020 DISINFORMASI,Facebook", "2020-04-24"],
    ["2019-03-04T10:00:00+07:00", "2019-03-04"],
  ])("%s → %s", (input, expected) => {
    expect(parseLooseDate(input)).toBe(expected);
  });

  it("returns an empty string for text without a date", () => {
    expect(parseLooseDate("no date here")).toBe("");
    expect(parseLooseDate(null)).toBe("");
  });
});

describe("text repair", () => {
  it("fixes UTF-8 read as cp1252", () => {
    expect(fixMojibake("â€œKominfo Tebar Hoaxâ€\u009d")).toContain("“Kominfo Tebar Hoax");
    expect(fixMojibake("Maâ€™ruf Amin")).toBe("Ma’ruf Amin");
  });

  it("drops publisher suffixes from titles", () => {
    expect(cleanTitle("[SALAH] Slogan Bersatu – Cek Fakta")).toBe("[SALAH] Slogan Bersatu");
    expect(cleanTitle("[SALAH] Klaim X - Hoax Buster | Covid19.go.id")).toBe("[SALAH] Klaim X");
    expect(cleanTitle("Ants In The Brain Hoax &#8211; Hoax-Slayer")).toBe("Ants In The Brain Hoax");
  });
});

describe("dataset labels", () => {
  it("maps the detector's classes to verdicts", () => {
    expect(datasetResult("HOAX", "")?.verdict).toBe("hoax");
    expect(datasetResult("DISINFORMATION", "")?.verdict).toBe("misleading");
    expect(datasetResult("FACT", "")?.verdict).toBe("valid");
    expect(datasetResult("INFORMATION", "[KLARIFIKASI] X")?.category).toBe("Clarification");
    expect(datasetResult("INFORMATION", "[BERITA] X")?.category).toBe("News");
    expect(datasetResult("UNKNOWN", "")).toBeNull();
  });

  it("restores sections from a one-line dataset text", () => {
    const row = cleanDatasetRow({
      id: "63621",
      text_category: "HOAX",
      title: "[SALAH] Hanya 13 Ribu Orang Terinfeksi - Hoax Buster | Covid19.go.id",
      author: "",
      publish_date: "09Jan2021",
      url: "https://covid19.go.id/p/hoax-buster/salah-hanya-13-ribu",
      website: "36",
      text:
        "Klaim tersebut tidak benar. Selengkapnya di bagian PENJELASAN = = = = = KATEGORI: KONTEN MENYESATKAN = = = = = " +
        "SUMBER: FACEBOOK https://archive.vn/6tqqc = = = = = NARASI: “Only 13,844 people were infected.” = = = = = " +
        "PENJELASAN: Faktanya kasus terinfeksi mencapai 2.488.780 orang sepanjang 2020 menurut data resmi pemerintah. = = = = = " +
        "REFERENSI: https://coronavirus.data.gov.uk/ Penulis: Rizky Editor: Bentang",
    });
    expect(row.title).toBe("[SALAH] Hanya 13 Ribu Orang Terinfeksi");
    expect(row.verdict).toBe("hoax");
    expect(row.date).toBe("2021-01-09");
    expect(row.sourceSite).toBe("covid19.go.id");
    expect(row.narration).toContain("13,844");
    expect(row.explanation).toContain("2.488.780");
    expect(row.reference).toBe("https://coronavirus.data.gov.uk/");
    expect(row.summary).toBe("Klaim tersebut tidak benar.");
  });
});

describe("WordPress posts", () => {
  const post = (title: string, html: string, url = "https://www.liputan6.com/cek-fakta/read/1/x") => ({
    id: 1,
    date: "2019-04-06T00:00:00",
    slug: "x",
    title: { rendered: title },
    content: { rendered: `${html}<p>Original Source : ${url}</p>` },
    categories: [2],
    featured_media: 0,
  });

  it("reads verdicts written in the headline", () => {
    expect(cleanPost(post("[Cek Fakta] Hoaks Bakso Tikus Beredar di Pasaran", "<p>Isi artikel yang cukup panjang untuk dibaca.</p>")).verdict).toBe("hoax");
    expect(cleanPost(post("[Cek Fakta] Pose Dua Jari Menteri Susi Tak Terkait Pilpres", "<p>Isi artikel.</p>")).verdict).toBe("misleading");
    // A question is not a verdict.
    expect(cleanPost(post("[Cek Fakta] Prabowo Sebut Negara Kita Seluas Eropa, Faktanya?", "<p>Isi artikel.</p>")).verdict).toBeNull();
  });

  it("splits turnbackhoax sections and drops layout separators", () => {
    const html =
      "<p>Hasil Periksa Fakta X.</p><p>= = = =</p><p>NARASI:</p><p>Pesan berantai palsu.</p><p>= = = =</p>" +
      "<p>PENJELASAN:</p><p>Faktanya tidak benar.</p><p>Selengkapnya pada penjelasan!</p><p>REFERENSI:</p><p>https://example.org/a</p>";
    const c = cleanPost({ ...post("[SALAH] Pesan Berantai", html, "https://turnbackhoax.id/2021/07/20/salah-pesan/"), categories: [] });
    expect(c.narration).toBe("Pesan berantai palsu.");
    expect(c.explanation).toContain("Faktanya tidak benar.");
    expect(c.explanation).not.toContain("= = =");
    expect(c.explanation).not.toContain("Selengkapnya");
    expect(c.reference).toBe("https://example.org/a");
  });
});
