export type Lang = "id" | "en";

/* ---- Scalar UI strings ------------------------------------------------ */
export const DICT: Record<Lang, Record<string, string>> = {
  id: {
    "nav.cta": "Cek Hoaks",
    "common.viewAll": "Lihat semua",
    "common.readMore": "Selengkapnya",

    "hero.badge": "Riset RAG Fusion",
    "hero.title.a": "Beri saya sebuah",
    "hero.title.hoax": "hoaks",
    "hero.title.b": "saya beri kamu analisanya.",
    "hero.subtitle":
      "Tempel artikel, berita, atau pesan berantai yang kamu ragukan. Sistem mendeteksi bahasanya, menilai probabilitas hoaks, dan menunjukkan referensi untuk verifikasi, berbasis text-mining, machine learning, dan Retrieval-Augmented Generation.",
    "hero.cta.primary": "Mulai Cek Hoaks →",
    "hero.cta.secondary": "Cara kerjanya",
    "hero.disclaimer": "Hasil bersifat prediksi & tidak dapat dijadikan bukti hukum.",

    "sources.label": "Diselaraskan dengan basis periksa-fakta tepercaya",

    "how.eyebrow": "Cara Kerja",
    "how.title": "Dari teks mentah ke penilaian, tanpa menebak.",
    "how.intro":
      "Empat langkah: preprocessing text-mining klasik lalu penilaian RAG Fusion yang menarik referensi relevan dari basis data.",

    "compare.eyebrow": "Kenapa Analyzer",
    "compare.title": "Ini yang bikin beda dari sekadar menebak.",
    "compare.with": "Dengan Hoax Analyzer",
    "compare.without": "Tanpa alat bantu",

    "tips.eyebrow": "Literasi Digital",
    "tips.title": "6 cara cepat mengenali hoaks sendiri.",
    "tips.intro":
      "Alat ini membantu, tapi mata kritis kamu tetap pertahanan pertama. Ingat enam hal ini.",

    "recent.eyebrow": "Periksa Fakta Terbaru",
    "recent.title": "Arsip hoaks yang sudah dibedah.",

    "faq.eyebrow": "FAQ",
    "faq.title": "Jawaban atas yang sering ditanyakan.",

    "cta.title.a": "Ragu dengan sebuah kabar?",
    "cta.title.b": "Cek dulu.",
    "cta.body":
      "Butuh 10 detik. Tempel teksnya, biarkan sistem yang menilai dan menunjukkan referensinya.",
    "cta.primary": "Buka Detektor →",
    "cta.secondary": "Laporkan Hoaks",

    "footer.tagline":
      "Deteksi dan analisa hoaks Bahasa Indonesia & Inggris dengan pendekatan text-mining, machine learning, dan RAG Fusion.",
    "footer.col.product": "Produk",
    "footer.col.research": "Riset",
    "footer.col.contact": "Kontak",
    "footer.link.detector": "Detektor Hoaks",
    "footer.link.blog": "Blog Periksa Fakta",
    "footer.link.report": "Lapor Hoaks",
    "footer.link.disclaimer": "Disclaimer",
    "footer.link.ragfusion": "RAG Fusion",
    "footer.link.about": "Tentang Riset",
    "footer.link.method": "Metodologi",
    "footer.link.contact": "Contact Us",
    "footer.rights": "Hasil bersifat prediksi.",

    "det.eyebrow": "Hoax Detection & Analyzer",
    "det.title.a": "Beri saya sebuah",
    "det.title.hoax": "hoaks",
    "det.intro":
      "Tempel artikel, berita, atau pesan berantai. Sistem mendeteksi bahasa, menjalankan analisa, dan menampilkan verdict beserta referensi untuk kamu verifikasi sendiri.",
    "det.input": "Input",
    "det.langDetected": "Bahasa terdeteksi:",
    "det.placeholder":
      "Tempel artikel, berita, atau pesan berantai yang ingin kamu periksa…",
    "det.clear": "Bersihkan",
    "det.chars": "karakter",
    "det.submit": "Proses & Analisa",
    "det.analyzing": "Menganalisa…",
    "det.recent": "Cek terakhir",
    "det.clearHistory": "Hapus riwayat",
    "det.sample.hoaxId": "Contoh hoaks (ID)",
    "det.sample.credId": "Contoh kredibel (ID)",
    "det.sample.hoaxEn": "Sample hoax (EN)",

    "res.verdict": "Verdict",
    "res.language": "Bahasa",
    "res.confidence": "Keyakinan",
    "res.explanation": "Penjelasan",
    "res.signals": "Sinyal terdeteksi",
    "res.signalsLegend": "▲ penanda risiko · ✓ penanda kredibel",
    "res.references": "Referensi",
    "res.copy": "Salin hasil",
    "res.copied": "Tersalin",
    "res.demoNote":
      "Hasil ini dari heuristik lokal, bukan model RAG Fusion asli.",
    "res.demoTag": "Mode demo.",
    "res.footer":
      "Hasil bersifat prediksi dan tidak dapat dijadikan bukti hukum.",

    "blog.eyebrow": "Blog",
    "blog.title": "Arsip periksa fakta.",
    "blog.intro":
      "Kumpulan hoaks yang sudah dibedah: narasi aslinya, penjelasan, dan referensi terverifikasi. Format bilingual mengikuti arsip asli.",
    "blog.filter.all": "Semua",
    "blog.note":
      "Arsip asli memuat 8.300+ artikel. Migrasi konten penuh dilakukan saat integrasi CMS / basis data.",
    "blog.back": "← Kembali ke Blog",
    "blog.originalSource": "Sumber asli",
    "blog.openLink": "Buka tautan ↗",

    "report.eyebrow": "Lapor Hoaks",
    "report.title": "Temukan hoaks? Laporkan.",
    "report.intro":
      "Bantu perbaiki sistem. Kirim teks/tautan yang kamu ragukan, atau koreksi bila hasil deteksi menurutmu keliru.",
    "report.after": "Apa yang terjadi setelah lapor?",
    "report.step1": "Laporan masuk ke antrean verifikasi.",
    "report.step2": "Tim memeriksa terhadap referensi.",
    "report.step3": "Sistem diperbarui bila terbukti.",
    "report.general": "Untuk pertanyaan umum, gunakan halaman",

    "contact.eyebrow": "Contact Us",
    "contact.title": "Mari bicara.",
    "contact.intro":
      "Pertanyaan tentang riset, kolaborasi, atau sistem? Kirim pesan, kami akan menindaklanjuti lewat email.",

    "about.eyebrow": "Tentang Riset",
    "about.title.a": "Hoax Analyzer,",
    "about.title.b": "give me a hoax",
    "about.intro":
      "Eksperimen ini bertujuan memilih algoritma terbaik untuk mengklasifikasi berita hoaks dan non-hoaks berbahasa Indonesia dan Inggris dengan metode text-mining dan machine learning.",

    "disclaimer.eyebrow": "Disclaimer",
    "disclaimer.title": "Baca dulu sebelum memakai.",
    "disclaimer.intro":
      "Sistem ini alat bantu prediksi, bukan penentu kebenaran mutlak. Berikut ketentuannya.",

    "form.firstName": "Nama depan",
    "form.lastName": "Nama belakang",
    "form.email": "Email",
    "form.emailHint": "Agar kami bisa menindaklanjuti.",
    "form.subject": "Subjek",
    "form.message": "Pesan",
    "form.sendReport": "Kirim Laporan",
    "form.sendMessage": "Kirim Pesan",
    "form.sending": "Mengirim…",

    "about.a1.title": "Text Mining",
    "about.a1.body": "Filtering, stopword removal, dan stemming untuk membersihkan teks sebelum klasifikasi.",
    "about.a2.title": "Machine Learning",
    "about.a2.body": "Perbandingan algoritma untuk memilih klasifier hoaks/non-hoaks terbaik pada data ID & EN.",
    "about.a3.title": "RAG Fusion",
    "about.a3.body": "Retrieval-Augmented Generation menggabungkan pencarian informasi dan model generatif untuk akurasi & keterjelasan.",
    "about.research.eyebrow": "Riset lanjutan",
    "about.research.title": "Hoax Detection Using RAG Fusion Based Framework",
    "about.research.body": "Riset berjalan berfokus pada deteksi berita hoaks Bahasa Indonesia dengan kerangka Retrieval-Augmented Generation (RAG), memadukan kekuatan information retrieval dan model generatif untuk meningkatkan akurasi serta interpretabilitas.",
    "about.tryDetector": "Coba Detektor →",
    "about.contactLine": "Kontak riset & informasi hoaks:",

    "contact.emailLabel": "Email",
    "contact.researchLabel": "Riset",
    "contact.researchBody": "Text-mining, machine learning, dan Retrieval-Augmented Generation untuk deteksi hoaks Bahasa Indonesia & Inggris.",

    "blog.factcheck": "Periksa Fakta",
    "blog.filter.id": "Indonesia",
    "blog.filter.en": "English",
  },

  en: {
    "nav.cta": "Check a Hoax",
    "common.viewAll": "View all",
    "common.readMore": "Read more",

    "hero.badge": "RAG Fusion research",
    "hero.title.a": "Give me a",
    "hero.title.hoax": "hoax",
    "hero.title.b": "and I'll give you the analysis.",
    "hero.subtitle":
      "Paste an article, news item, or forwarded message you doubt. The system detects its language, scores the hoax probability, and shows references to verify, powered by text-mining, machine learning, and Retrieval-Augmented Generation.",
    "hero.cta.primary": "Start Checking →",
    "hero.cta.secondary": "How it works",
    "hero.disclaimer": "Results are predictions & cannot serve as legal evidence.",

    "sources.label": "Aligned with trusted fact-checking databases",

    "how.eyebrow": "How It Works",
    "how.title": "From raw text to a verdict, without guessing.",
    "how.intro":
      "Four steps: classic text-mining preprocessing, then a RAG Fusion assessment that pulls relevant references from the database.",

    "compare.eyebrow": "Why Analyzer",
    "compare.title": "Here's what sets it apart from guessing.",
    "compare.with": "With Hoax Analyzer",
    "compare.without": "Without any tool",

    "tips.eyebrow": "Digital Literacy",
    "tips.title": "6 quick ways to spot a hoax yourself.",
    "tips.intro":
      "This tool helps, but your critical eye is the first line of defense. Remember these six.",

    "recent.eyebrow": "Latest Fact-Checks",
    "recent.title": "The archive of dissected hoaxes.",

    "faq.eyebrow": "FAQ",
    "faq.title": "Answers to what people ask most.",

    "cta.title.a": "Unsure about some news?",
    "cta.title.b": "Check it first.",
    "cta.body":
      "Takes 10 seconds. Paste the text, let the system score it and show the references.",
    "cta.primary": "Open the Detector →",
    "cta.secondary": "Report a Hoax",

    "footer.tagline":
      "Detect and analyze Indonesian & English hoaxes using text-mining, machine learning, and RAG Fusion.",
    "footer.col.product": "Product",
    "footer.col.research": "Research",
    "footer.col.contact": "Contact",
    "footer.link.detector": "Hoax Detector",
    "footer.link.blog": "Fact-Check Blog",
    "footer.link.report": "Report a Hoax",
    "footer.link.disclaimer": "Disclaimer",
    "footer.link.ragfusion": "RAG Fusion",
    "footer.link.about": "About the Research",
    "footer.link.method": "Methodology",
    "footer.link.contact": "Contact Us",
    "footer.rights": "Results are predictions.",

    "det.eyebrow": "Hoax Detection & Analyzer",
    "det.title.a": "Give me a",
    "det.title.hoax": "hoax",
    "det.intro":
      "Paste an article, news item, or forwarded message. The system detects the language, runs the analysis, and shows a verdict with references for you to verify yourself.",
    "det.input": "Input",
    "det.langDetected": "Detected language:",
    "det.placeholder":
      "Paste the article, news item, or forwarded message you want to check…",
    "det.clear": "Clear",
    "det.chars": "characters",
    "det.submit": "Process & Analyze",
    "det.analyzing": "Analyzing…",
    "det.recent": "Recent checks",
    "det.clearHistory": "Clear history",
    "det.sample.hoaxId": "Hoax sample (ID)",
    "det.sample.credId": "Credible sample (ID)",
    "det.sample.hoaxEn": "Hoax sample (EN)",

    "res.verdict": "Verdict",
    "res.language": "Language",
    "res.confidence": "Confidence",
    "res.explanation": "Explanation",
    "res.signals": "Detected signals",
    "res.signalsLegend": "▲ risk marker · ✓ credibility marker",
    "res.references": "References",
    "res.copy": "Copy result",
    "res.copied": "Copied",
    "res.demoNote":
      "The trained detection model is not connected yet. This verdict comes from matching your text against the fact-check archive, or from a simple keyword heuristic when nothing matches.",
    "res.demoTag": "Demo mode.",
    "res.footer": "Results are predictions and cannot serve as legal evidence.",

    "blog.eyebrow": "Blog",
    "blog.title": "The fact-check archive.",
    "blog.intro":
      "Thousands of dissected hoaxes in Indonesian and English: the claim, what the fact-checkers found, and the sources to verify it yourself.",
    "blog.filter.all": "All",
    "blog.note": "Entries are collected from public fact-checking sites and link back to the original article.",
    "blog.back": "← Back to Blog",
    "blog.originalSource": "Original source",
    "blog.openLink": "Open link ↗",

    "report.eyebrow": "Report a Hoax",
    "report.title": "Found a hoax? Report it.",
    "report.intro":
      "Help improve the system. Send the text/link you doubt, or correct a detection result you think is wrong.",
    "report.after": "What happens after you report?",
    "report.step1": "The report enters the verification queue.",
    "report.step2": "The team checks it against references.",
    "report.step3": "The system is updated once confirmed.",
    "report.general": "For general questions, use the",

    "contact.eyebrow": "Contact Us",
    "contact.title": "Let's talk.",
    "contact.intro":
      "Questions about the research, collaboration, or the system? Send a message, we'll follow up by email.",

    "about.eyebrow": "About the Research",
    "about.title.a": "Hoax Analyzer,",
    "about.title.b": "give me a hoax",
    "about.intro":
      "This experiment aims to select the best algorithm for classifying hoax and non-hoax news in Indonesian and English using text-mining and machine learning methods.",

    "disclaimer.eyebrow": "Disclaimer",
    "disclaimer.title": "Read this before you use it.",
    "disclaimer.intro":
      "This system is a prediction aid, not an absolute arbiter of truth. Here are the terms.",

    "form.firstName": "First name",
    "form.lastName": "Last name",
    "form.email": "Email",
    "form.emailHint": "So we can follow up with you.",
    "form.subject": "Subject",
    "form.message": "Message",
    "form.sendReport": "Send Report",
    "form.sendMessage": "Send Message",
    "form.sending": "Sending…",

    "about.a1.title": "Text Mining",
    "about.a1.body": "Filtering, stopword removal, and stemming to clean the text before classification.",
    "about.a2.title": "Machine Learning",
    "about.a2.body": "Comparing algorithms to pick the best hoax / non-hoax classifier on ID & EN data.",
    "about.a3.title": "RAG Fusion",
    "about.a3.body": "Retrieval-Augmented Generation combines information retrieval and generative models for accuracy & interpretability.",
    "about.research.eyebrow": "Ongoing research",
    "about.research.title": "Hoax Detection Using RAG Fusion Based Framework",
    "about.research.body": "The ongoing research focuses on detecting Indonesian hoax news with a Retrieval-Augmented Generation (RAG) framework, combining the strengths of information retrieval and generative models to improve accuracy and interpretability.",
    "about.tryDetector": "Try the Detector →",
    "about.contactLine": "Research contact & hoax info:",

    "contact.emailLabel": "Email",
    "contact.researchLabel": "Research",
    "contact.researchBody": "Text-mining, machine learning, and Retrieval-Augmented Generation for Indonesian & English hoax detection.",

    "blog.factcheck": "Fact-Check",
    "blog.filter.id": "Indonesian",
    "blog.filter.en": "English",
  },
};

/* ---- Structured / list content ---------------------------------------- */
export const NAV: Record<Lang, { href: string; label: string }[]> = {
  id: [
    { href: "/", label: "Home" },
    { href: "/detector", label: "Detektor" },
    { href: "/blog", label: "Blog" },
    { href: "/report", label: "Lapor Hoaks" },
    { href: "/about", label: "Tentang" },
  ],
  en: [
    { href: "/", label: "Home" },
    { href: "/detector", label: "Detector" },
    { href: "/blog", label: "Blog" },
    { href: "/report", label: "Report" },
    { href: "/about", label: "About" },
  ],
};

export const STATS: Record<Lang, { value: number; suffix: string; label: string; sub: string }[]> = {
  id: [
    { value: 8300, suffix: "+", label: "Artikel periksa fakta", sub: "Bahasa Indonesia & Inggris" },
    { value: 5969, suffix: "", label: "Entri Bahasa Indonesia", sub: "Kategori lokal" },
    { value: 2331, suffix: "", label: "Entri English", sub: "Sumber internasional" },
    { value: 2, suffix: "", label: "Bahasa didukung", sub: "Deteksi otomatis ID / EN" },
  ],
  en: [
    { value: 8300, suffix: "+", label: "Fact-check articles", sub: "Indonesian & English" },
    { value: 5969, suffix: "", label: "Indonesian entries", sub: "Local categories" },
    { value: 2331, suffix: "", label: "English entries", sub: "International sources" },
    { value: 2, suffix: "", label: "Languages supported", sub: "Auto ID / EN detection" },
  ],
};

export const HOW: Record<Lang, { step: string; kicker: string; title: string; body: string }[]> = {
  id: [
    { step: "01", kicker: "Input", title: "Tempel teksnya", body: "Salin artikel, berita, atau pesan berantai yang kamu ragukan ke kolom analisa. Mendukung teks panjang." },
    { step: "02", kicker: "Preprocess", title: "Deteksi bahasa", body: "Sistem mengenali Bahasa Indonesia atau Inggris, lalu menjalankan filtering, stopword removal, dan stemming." },
    { step: "03", kicker: "Analyze", title: "RAG Fusion menilai", body: "Retrieval-Augmented Generation menarik referensi relevan dari basis data dan menilai probabilitas hoaks." },
    { step: "04", kicker: "Result", title: "Hasil & referensi", body: "Dapatkan verdict, tingkat keyakinan, penjelasan, dan tautan referensi untuk verifikasi mandiri." },
  ],
  en: [
    { step: "01", kicker: "Input", title: "Paste the text", body: "Copy the article, news item, or forwarded message you doubt into the analysis box. Long text supported." },
    { step: "02", kicker: "Preprocess", title: "Detect language", body: "The system recognizes Indonesian or English, then runs filtering, stopword removal, and stemming." },
    { step: "03", kicker: "Analyze", title: "RAG Fusion scores it", body: "Retrieval-Augmented Generation pulls relevant references from the database and scores the hoax probability." },
    { step: "04", kicker: "Result", title: "Verdict & references", body: "Get a verdict, confidence level, explanation, and reference links to verify on your own." },
  ],
};

export const COMPARISON: Record<Lang, { withUs: string[]; without: string[] }> = {
  id: {
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
  },
  en: {
    withUs: [
      "Automatic ID & EN language detection",
      "Verdict + a measured confidence level",
      "Traceable fact-check references",
      "An explanation of why something is judged a hoax",
      "Grounded in RAG Fusion research",
    ],
    without: [
      "Guessing a story's credibility yourself",
      "No idea how confident the judgment is",
      "Sources of unclear origin",
      "A label with no reasoning",
      "Relying on hearsay",
    ],
  },
};

export const FAQ: Record<Lang, { q: string; a: string }[]> = {
  id: [
    { q: "Apakah hasilnya bisa dijadikan bukti hukum?", a: "Tidak. Hasil sistem hanya berupa prediksi berbasis analisa referensi, tidak dapat dijadikan barang bukti di pengadilan. Selalu verifikasi ke sumber resmi." },
    { q: "Bahasa apa saja yang didukung?", a: "Saat ini Bahasa Indonesia dan Inggris. Bahasa dideteksi otomatis dari teks yang kamu masukkan." },
    { q: "Jenis input apa yang bisa dianalisa?", a: "Input berupa teks: artikel, berita, atau pesan terusan. Untuk konten gambar/video, sertakan deskripsi teksnya." },
    { q: "Bagaimana kalau hasilnya menurut saya salah?", a: "Laporkan lewat halaman Lapor Hoaks. Sistem terus diperbaiki berdasarkan laporan pengguna dan verifikasi tim." },
    { q: "Apa itu RAG Fusion?", a: "Retrieval-Augmented Generation Fusion menggabungkan pencarian informasi dan model generatif untuk meningkatkan akurasi dan keterjelasan deteksi hoaks." },
    { q: "Apakah data yang saya tempel disimpan?", a: "Teks hanya diproses untuk analisa. Pada versi ini tidak ada penyimpanan permanen di sisi klien." },
  ],
  en: [
    { q: "Can the result serve as legal evidence?", a: "No. The system's result is only a reference-based prediction and cannot serve as evidence in court. Always verify with official sources." },
    { q: "Which languages are supported?", a: "Currently Indonesian and English. The language is detected automatically from the text you enter." },
    { q: "What kind of input can be analyzed?", a: "Text input: articles, news, or forwarded messages. For image/video content, include a text description." },
    { q: "What if I think the result is wrong?", a: "Report it via the Report a Hoax page. The system keeps improving based on user reports and team verification." },
    { q: "What is RAG Fusion?", a: "Retrieval-Augmented Generation Fusion combines information retrieval and generative models to improve the accuracy and interpretability of hoax detection." },
    { q: "Is the text I paste stored?", a: "Yes. The text you check is saved on our server together with its verdict, without your IP address, so we can see which claims are circulating and improve the detector. Please don't paste private information. Your last five checks are also remembered in this browser, and you can clear them at any time." },
    { q: "Where do the fact-checks come from?", a: "The archive collects published fact-checks from TurnBackHoax (MAFINDO), Kominfo, the COVID-19 task force, Tempo, Kompas, CekFakta.com, Hoax-Slayer and others. Every entry links to the original article." },
  ],
};

export const TIPS: Record<Lang, { icon: string; title: string; body: string }[]> = {
  id: [
    { icon: "title", title: "Curigai judul bombastis", body: "Judul dengan HURUF KAPITAL, tanda seru bertumpuk, atau kata 'VIRAL/WAJIB SEBARKAN' sering menandakan clickbait atau hoaks." },
    { icon: "source", title: "Cek sumber aslinya", body: "Telusuri siapa penerbitnya. Media kredibel mencantumkan nama, tanggal, dan narasumber yang bisa diverifikasi." },
    { icon: "date", title: "Perhatikan tanggal", body: "Berita lama sering didaur ulang seolah baru. Pastikan konteks dan waktu kejadiannya masih relevan." },
    { icon: "image", title: "Verifikasi gambar & video", body: "Gambar bisa diambil dari peristiwa berbeda. Gunakan reverse image search untuk cek asal-usulnya." },
    { icon: "bias", title: "Waspadai emosi berlebih", body: "Konten yang memancing amarah atau ketakutan ekstrem dibuat agar cepat disebar tanpa dipikir ulang." },
    { icon: "cross", title: "Cek silang beberapa sumber", body: "Kalau hanya satu situs tak dikenal yang memberitakan, kemungkinan besar itu tidak kredibel." },
  ],
  en: [
    { icon: "title", title: "Suspect bombastic headlines", body: "Headlines in ALL CAPS, stacked exclamation marks, or words like 'VIRAL/MUST SHARE' often signal clickbait or a hoax." },
    { icon: "source", title: "Check the original source", body: "Trace who published it. Credible outlets list names, dates, and sources you can verify." },
    { icon: "date", title: "Mind the date", body: "Old news is often recycled as if new. Make sure the context and timing are still relevant." },
    { icon: "image", title: "Verify images & video", body: "An image may be taken from a different event. Use reverse image search to check its origin." },
    { icon: "bias", title: "Beware extreme emotion", body: "Content that provokes anger or extreme fear is built to be shared fast without a second thought." },
    { icon: "cross", title: "Cross-check several sources", body: "If only one unknown site reports it, it is most likely not credible." },
  ],
};

export const DISCLAIMER_POINTS: Record<Lang, string[]> = {
  id: [
    "Sistem ini masih dalam proses pengembangan.",
    "Sistem hanya menerima input berupa artikel / berita / informasi dalam bentuk teks. Jika ada informasi berbentuk gambar / file / video, harap sertakan deskripsi file terkait.",
    "Sistem memberikan prediksi hoaks berdasarkan analisis terhadap referensi yang ditemukan di basis data.",
    "Sistem menyediakan artikel referensi yang relevan dengan masukan pengguna.",
    "Hasil sistem hanya berupa prediksi, tidak dapat dijadikan barang bukti di pengadilan. Segala kerugian yang disebabkan oleh sistem bukan tanggung jawab pengembang.",
    "Jika hasil dianggap tidak benar, pengguna dapat melaporkannya melalui fitur pengaduan. Sistem terus diperbaiki berdasarkan laporan pengguna dan verifikasi tim yang berwenang.",
    "Agar hasil lebih baik, gunakan masukan dari artikel / berita asli dari internet atau pesan terusan (forward) di media sosial.",
  ],
  en: [
    "This system is still under development.",
    "The system only accepts text input: articles / news / information. For image / file / video content, please include a text description of it.",
    "The system gives a hoax prediction based on analysis against references found in its database.",
    "The system provides reference articles relevant to the user's input.",
    "The system's result is only a prediction and cannot serve as evidence in court. Any loss caused by the system is not the developer's responsibility.",
    "If a result is considered incorrect, users can report it via the complaint feature. The system keeps improving based on user reports and verification by the authorized team.",
    "For better results, use input from original articles / news from the internet or forwarded messages on social media.",
    "Text submitted to the detector is stored together with its verdict, without the sender's IP address, to improve the system. Do not submit personal or confidential information.",
  ],
};
