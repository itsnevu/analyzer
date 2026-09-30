import type { Verdict } from "./detect";

export const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/detector", label: "Detektor" },
  { href: "/blog", label: "Blog" },
  { href: "/report", label: "Lapor Hoaks" },
  { href: "/about", label: "Tentang" },
];

export const STATS = [
  { value: 8300, suffix: "+", label: "Artikel periksa fakta", sub: "Bahasa Indonesia & Inggris" },
  { value: 5969, suffix: "", label: "Entri Bahasa Indonesia", sub: "Kategori lokal" },
  { value: 2331, suffix: "", label: "Entri English", sub: "Sumber internasional" },
  { value: 2, suffix: "", label: "Bahasa didukung", sub: "Deteksi otomatis ID / EN" },
];

export const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Tempel teksnya",
    kicker: "Input",
    body: "Salin artikel, berita, atau pesan berantai yang kamu ragukan ke kolom analisa. Mendukung teks panjang.",
  },
  {
    step: "02",
    title: "Deteksi bahasa",
    kicker: "Preprocess",
    body: "Sistem mengenali Bahasa Indonesia atau Inggris, lalu menjalankan filtering, stopword removal, dan stemming.",
  },
  {
    step: "03",
    title: "RAG Fusion menilai",
    kicker: "Analyze",
    body: "Retrieval-Augmented Generation menarik referensi relevan dari basis data dan menilai probabilitas hoaks.",
  },
  {
    step: "04",
    title: "Hasil & referensi",
    kicker: "Result",
    body: "Dapatkan verdict, tingkat keyakinan, penjelasan, dan tautan referensi untuk verifikasi mandiri.",
  },
];

export const COMPARISON = {
  withUs: [
    "Deteksi bahasa otomatis ID & EN",
    "Verdict + tingkat keyakinan terukur",
    "Referensi periksa fakta yang bisa ditelusuri",
    "Penjelasan mengapa sesuatu dinilai hoaks",
    "Berbasis riset RAG Fusion",
  ],
  without: [
    "Menebak sendiri kredibilitas berita",
    "Tidak tahu seberapa yakin penilaiannya",
    "Sumber tidak jelas asalnya",
    "Label tanpa alasan",
    "Mengandalkan kata orang",
  ],
};

export const FAQ = [
  {
    q: "Apakah hasilnya bisa dijadikan bukti hukum?",
    a: "Tidak. Hasil sistem hanya berupa prediksi berbasis analisa referensi, tidak dapat dijadikan barang bukti di pengadilan. Selalu verifikasi ke sumber resmi.",
  },
  {
    q: "Bahasa apa saja yang didukung?",
    a: "Saat ini Bahasa Indonesia dan Inggris. Bahasa dideteksi otomatis dari teks yang kamu masukkan.",
  },
  {
    q: "Jenis input apa yang bisa dianalisa?",
    a: "Input berupa teks: artikel, berita, atau pesan terusan. Untuk konten gambar/video, sertakan deskripsi teksnya.",
  },
  {
    q: "Bagaimana kalau hasilnya menurut saya salah?",
    a: "Laporkan lewat halaman Lapor Hoaks. Sistem terus diperbaiki berdasarkan laporan pengguna dan verifikasi tim.",
  },
  {
    q: "Apa itu RAG Fusion?",
    a: "Retrieval-Augmented Generation Fusion menggabungkan pencarian informasi dan model generatif untuk meningkatkan akurasi dan keterjelasan deteksi hoaks.",
  },
  {
    q: "Apakah data yang saya tempel disimpan?",
    a: "Teks hanya diproses untuk analisa. Pada versi ini tidak ada penyimpanan permanen di sisi klien.",
  },
];

export interface Article {
  slug: string;
  title: string;
  lang: "id" | "en";
  category: string;
  verdict: Verdict;
  date: string;
  summaryId: string;
  summaryEn: string;
  source: string;
  narration: string;
  explanation: string;
  reference: string;
  /** Empty for articles imported from the legacy archive, which have no cover of their own. */
  image: string;
  originalUrl?: string;
  /** Site that published the fact-check, for imported articles (e.g. "turnbackhoax.id"). */
  sourceSite?: string;
  /** False hides the article from the public site. Defaults to true. */
  published?: boolean;
}

/** What a list or card shows; the article body stays in the database. */
export interface ArticleListItem {
  slug: string;
  title: string;
  lang: Article["lang"];
  category: string;
  verdict: Verdict;
  date: string;
  summary: string;
  image: string;
  sourceSite: string;
  published: boolean;
}

export const ARTICLES: Article[] = [
  {
    slug: "artificial-clouds-generation-system",
    title: "“Artificial Clouds Generation System”",
    lang: "id",
    category: "Misinformasi",
    verdict: "misleading",
    date: "2019-04-06",
    summaryId:
      "Video tersebut adalah video lelucon April Mop, direspon dengan keliru oleh banyak orang yang menganggapnya sebagai sesuatu yang serius.",
    summaryEn:
      "The video was meant to be shared as April Fool, falsely responded by many people who took it as something serious.",
    source:
      "(1) Pertanyaan dari salah satu anggota FAFHH. (2) bit.ly/2IL1etB, sudah dibagikan 386.950 kali per tangkapan layar dibuat.",
    narration: "“Artificial Clouds Generation System”",
    explanation:
      "Video ini adalah klip yang diedit dari dua tes mesin roket berbeda di NASA Stennis Space Center. NASA tidak memiliki mesin pembuat awan, uap yang terlihat adalah hasil pembakaran oksigen cair dan hidrogen cair pada uji mesin roket. Video disebarkan 1 April dan memuat watermark akun flat-earth, sehingga patut dicurigai sebagai lelucon yang ditanggap serius.",
    reference:
      "The Verge, “No, NASA doesn't have a cloud-making machine, it has a rocket engine.” Loren Grush, 10 Apr 2018.",
    image: "/articles/clouds.jpg?v=2",
    originalUrl:
      "https://turnbackhoax.id/2018/04/11/salah-artificial-clouds-generation-system-false-artificial-clouds-generation-system/",
  },
  {
    slug: "nasa-1-day-total-darkness",
    title: "NASA ‘1 Day of Total Darkness’ Hoax",
    lang: "en",
    category: "Disinformation",
    verdict: "hoax",
    date: "2019-04-05",
    summaryId:
      "Klaim bahwa NASA memprediksi bumi akan gelap total selama beberapa hari adalah hoaks lama yang berulang.",
    summaryEn:
      "The claim that NASA predicted several days of total darkness on Earth is a recurring, long-debunked hoax.",
    source: "Beredar melalui rantai pesan dan situs clickbait.",
    narration: "“NASA confirms Earth will experience total darkness for days.”",
    explanation:
      "NASA never issued such a statement. The story originates from a satirical/clickbait site and has been recycled for years. No astronomical event causes multi-day global darkness.",
    reference: "Snopes, 'Days of Darkness' fact check.",
    image: "/articles/darkness.jpg?v=2",
  },
  {
    slug: "why-facebook-scammers-want-likes",
    title: "Why do Facebook Scammers Want Likes?",
    lang: "en",
    category: "Verified",
    verdict: "valid",
    date: "2019-04-04",
    summaryId:
      "Penjelasan kredibel mengenai bagaimana halaman penipuan mengumpulkan 'like' untuk kemudian dijual atau dialihkan.",
    summaryEn:
      "A credible explanation of how scam pages harvest likes to later resell or repurpose the page.",
    source: "Hoax-Slayer analysis.",
    narration: "How 'like-farming' pages operate on social media.",
    explanation:
      "This is an accurate explainer, not a hoax. Like-farming pages use emotional posts to gather engagement, then rebrand or sell the page. Treat viral 'type Amen to win' posts with suspicion.",
    reference: "Hoax-Slayer, Like farming explainer.",
    image: "/articles/scam.jpg?v=2",
  },
];

export function getArticle(slug: string): Article | undefined {
  return ARTICLES.find((a) => a.slug === slug);
}
