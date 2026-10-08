/** Indonesian for the public site, keyed by a dictionary key (lib/dictionary) or the English text in the code. See ../site-lang. */
export const detector: Record<string, string> = {
  // Detector page (app/detector)
  "Hoax Detector": "Detektor Hoaks",
  "Paste a news text or chain message and get a hoax assessment with references. Supports Indonesian & English.":
    "Tempelkan teks berita atau pesan berantai, lalu dapatkan penilaian hoaks beserta referensinya. Mendukung bahasa Indonesia dan Inggris.",
  "Results are predictions. Open the matching fact-checks and references before you share.":
    "Hasil ini berupa prediksi. Bukalah cek fakta dan referensi yang cocok sebelum Anda membagikannya.",
  "How it works": "Cara kerjanya",

  // Input card (components/detector/DetectorPanel)
  "Result ready: {verdict}, hoax probability {pct}%.": "Hasil sudah siap: {verdict}, kemungkinan hoaks {pct}%.",
  "No readable text was found in that image.": "Tidak ada teks yang bisa dibaca pada gambar itu.",
  "Text read from your screenshot. Check it for reading mistakes, then press the button to analyze it.":
    "Teks sudah dibaca dari tangkapan layar Anda. Periksa dulu apakah ada yang salah baca, lalu tekan tombol untuk menganalisisnya.",
  "The screenshot could not be read.": "Tangkapan layar tidak dapat dibaca.",
  "Something went wrong. Please try again.": "Terjadi kesalahan. Silakan coba lagi.",
  "The check could not reach the server. Check your connection and try again.":
    "Pemeriksaan tidak dapat terhubung ke server. Periksa koneksi internet Anda, lalu coba lagi.",
  "(detected)": "(terdeteksi)",
  "Reading your screenshot…": "Membaca tangkapan layar Anda…",
  "Reading your screenshot": "Membaca tangkapan layar Anda",
  "The first time downloads about 4 MB of language data.": "Pada penggunaan pertama, sekitar 4 MB data bahasa akan diunduh.",
  "Link detected: we will read the page and check its text.": "Tautan terdeteksi: kami akan membaca halamannya dan memeriksa teksnya.",
  "Add 1 more character to analyze.": "Tambahkan 1 karakter lagi agar bisa dianalisis.",
  "Add {n} more characters to analyze.": "Tambahkan {n} karakter lagi agar bisa dianalisis.",
  "Paste at least {n} characters, a link, or a screenshot.": "Tempelkan minimal {n} karakter, sebuah tautan, atau tangkapan layar.",
  "Tip: press {keys} to analyze.": "Tips: tekan {keys} untuk menganalisis.",
  "Every check is recorded for research on how this tool is used, with your IP address, network and device. Don't paste private information.":
    "Setiap pemeriksaan dicatat untuk penelitian tentang cara alat ini digunakan, beserta alamat IP, jaringan, dan perangkat Anda. Jangan menempelkan informasi pribadi.",
  "Privacy": "Privasi",

  // Research card (components/detector/ResearchCard)
  "Help our research (optional)": "Bantu penelitian kami (opsional)",
  "We study who uses a hoax checker. Who are you checking this as?":
    "Kami meneliti siapa saja yang memakai alat cek hoaks. Anda memeriksa ini sebagai apa?",
  "Journalist": "Jurnalis",
  "Fact-checker": "Pemeriksa fakta",
  "Student": "Pelajar atau mahasiswa",
  "Teacher or lecturer": "Guru atau dosen",
  "Researcher": "Peneliti",
  "Government": "Pemerintah",
  "NGO or community": "LSM atau komunitas",
  "General public": "Masyarakat umum",
  "Other": "Lainnya",
  "Organization, e.g. newsroom or campus (optional)": "Organisasi, misalnya redaksi atau kampus (opsional)",
  "Save": "Simpan",

  // Result card (components/detector/ResultCard)
  "This looks like a known claim. {verdict}: {title}": "Ini tampaknya klaim yang sudah pernah dicek. {verdict}: {title}",
  "Hoax Analyzer says: {verdict} ({pct}% hoax probability). Check a message yourself:":
    "Hasil Hoax Analyzer: {verdict} (kemungkinan hoaks {pct}%). Periksa sendiri pesan Anda:",
  "Read from the page": "Dibaca dari halaman",
  "Fallback.": "Mode cadangan.",
  "The configured detection model took too long to answer, so the site's own classifier and the fact-check archive answered instead.":
    "Model deteksi yang dipasang terlalu lama menjawab, sehingga hasil ini diberikan oleh pengklasifikasi milik situs ini dan arsip cek fakta.",
  "The configured detection model could not be used right now, so the site's own classifier and the fact-check archive answered instead.":
    "Model deteksi yang dipasang sedang tidak dapat digunakan, sehingga hasil ini diberikan oleh pengklasifikasi milik situs ini dan arsip cek fakta.",
  "Risk marker:": "Penanda risiko:",
  "Credibility marker:": "Penanda kredibilitas:",
  "word: {cue}": "kata: {cue}",
  "phrase: {cue}": "frasa: {cue}",
  "Model:": "Model:",
  "Terms": "Ketentuan",

  // Verdicts, languages, categories and signal labels (lib/verdict-labels)
  "Hoax": "Hoaks",
  "Misleading": "Menyesatkan",
  "Credible": "Kredibel",
  "Indonesian": "Bahasa Indonesia",
  "English": "Bahasa Inggris",
  "Disinformation": "Disinformasi",
  "Misinformation": "Misinformasi",
  "Verified": "Terverifikasi",
  "very short text": "teks sangat pendek",
  "excessive exclamation marks": "tanda seru berlebihan",
  "excessive capitals": "huruf kapital berlebihan",
  "matches an archived fact-check": "cocok dengan cek fakta di arsip",

  // Explanations the site writes (lib/detect, app/api/detect)
  "The detection model, trained on thousands of published fact-checks, read this text as a hoax (hoax {hoax}, misleading {misleading}, credible {credible}).":
    "Model deteksi, yang dilatih dengan ribuan cek fakta yang telah terbit, menilai teks ini sebagai hoaks (hoaks {hoax}, menyesatkan {misleading}, kredibel {credible}).",
  "The detection model, trained on thousands of published fact-checks, read this text as misleading (hoax {hoax}, misleading {misleading}, credible {credible}).":
    "Model deteksi, yang dilatih dengan ribuan cek fakta yang telah terbit, menilai teks ini menyesatkan (hoaks {hoax}, menyesatkan {misleading}, kredibel {credible}).",
  "The detection model, trained on thousands of published fact-checks, read this text as credible (hoax {hoax}, misleading {misleading}, credible {credible}).":
    "Model deteksi, yang dilatih dengan ribuan cek fakta yang telah terbit, menilai teks ini kredibel (hoaks {hoax}, menyesatkan {misleading}, kredibel {credible}).",
  "It weighs the wording against claims that fact-checkers have debunked or confirmed; it does not verify facts.":
    "Model ini membandingkan susunan kata dengan klaim yang telah dibantah atau dibenarkan oleh pemeriksa fakta; model ini tidak memverifikasi fakta.",
  "Strongest cues toward hoax: {cues}.": "Petunjuk terkuat ke arah hoaks: {cues}.",
  "Toward credible: {cues}.": "Ke arah kredibel: {cues}.",
  "Verify with official sources before sharing.": "Pastikan dengan sumber resmi sebelum membagikannya.",
  "The text shows {n} hoax-pattern markers (calls to share, absolute claims, excessive capitals) and matches known disinformation patterns in the reference base. Verify with official sources before sharing.":
    "Teks ini menunjukkan {n} penanda pola hoaks (ajakan menyebarkan, klaim mutlak, huruf kapital berlebihan) dan cocok dengan pola disinformasi yang dikenal dalam basis referensi. Pastikan dengan sumber resmi sebelum membagikannya.",
  "The text carries some misleading markers but is not conclusive. It may be partly true yet framed in a misleading way. Check the related references below.":
    "Teks ini memuat beberapa penanda yang menyesatkan, tetapi belum bisa disimpulkan. Isinya mungkin sebagian benar, namun disajikan dengan cara yang menyesatkan. Periksa referensi terkait di bawah ini.",
  "No strong hoax markers were found. The text reads like a credible source, but always cross-check for important decisions.":
    "Tidak ditemukan penanda hoaks yang kuat. Teks ini terbaca seperti sumber yang kredibel, tetapi selalu periksa silang untuk keputusan penting.",
  "Your text closely matches a claim that was already fact-checked: “{title}”, rated hoax.":
    "Teks Anda sangat mirip dengan klaim yang sudah pernah dicek faktanya: “{title}”, dengan hasil hoaks.",
  "Your text closely matches a claim that was already fact-checked: “{title}”, rated misleading.":
    "Teks Anda sangat mirip dengan klaim yang sudah pernah dicek faktanya: “{title}”, dengan hasil menyesatkan.",
  "Your text closely matches a claim that was already fact-checked: “{title}”, rated credible.":
    "Teks Anda sangat mirip dengan klaim yang sudah pernah dicek faktanya: “{title}”, dengan hasil kredibel.",
  "Open the matching fact-checks below for the full explanation and sources.":
    "Buka cek fakta yang cocok di bawah ini untuk membaca penjelasan lengkap dan sumbernya.",

  // The standard references the local engines attach (lib/detect)
  "Guide to Fighting Hoaxes, turnbackhoax.id": "Panduan Melawan Hoaks, turnbackhoax.id",
  "Community fact-check database for Indonesian-language news.": "Basis data cek fakta komunitas untuk berita berbahasa Indonesia.",
  "Fact Check, Kominfo": "Cek Fakta, Kominfo",
  "Indonesian Ministry of Communication (Kominfo)": "Kementerian Komunikasi dan Informatika (Kominfo)",
  "Official clarifications of hoaxes circulating in public.": "Klarifikasi resmi atas hoaks yang beredar di masyarakat.",
  "How to spot fake news, IFLA": "Cara mengenali berita palsu, IFLA",
  "Eight steps to evaluate the credibility of a news item.": "Delapan langkah untuk menilai kredibilitas sebuah berita.",
};
