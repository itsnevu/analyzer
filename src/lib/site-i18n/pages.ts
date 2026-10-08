/** Indonesian for the public site, keyed by a dictionary key (lib/dictionary) or the English text in the code. See ../site-lang. */
// About, contact, report, disclaimer, privacy, stats, offline and the error pages.
export const pages: Record<string, string> = {
  /* ---- Report ---- */
  "report.eyebrow": "Laporkan Hoaks",
  "report.title": "Menemukan hoaks? Laporkan.",
  "report.intro": "Bantu kami menyempurnakan sistem. Kirim teks/tautan yang Anda ragukan, atau koreksi hasil deteksi yang menurut Anda keliru.",
  "report.after": "Apa yang terjadi setelah Anda melapor?",
  "report.step1": "Anda langsung mendapatkan nomor laporan.",
  "report.step2": "Admin memeriksanya dengan cek fakta yang sudah terbit.",
  "report.step3": "Hoaks yang terkonfirmasi ditambahkan ke arsip, sehingga detektor dapat mengenalinya di kemudian hari.",
  "report.general": "Untuk pertanyaan umum, silakan gunakan <link>formulir kontak</link>.",
  "Before you report": "Sebelum Anda melapor",
  "It may already have been fact-checked. Paste it into the <detector>detector</detector> or search the <archive>archive</archive> first.":
    "Bisa jadi informasi itu sudah pernah dicek fakta. Tempelkan dulu ke <detector>detektor</detector> atau cari di <archive>arsip</archive>.",

  /* ---- Contact ---- */
  "contact.eyebrow": "Hubungi Kami",
  "contact.title": "Mari berbincang.",
  "contact.intro": "Ada pertanyaan tentang riset, kerja sama, atau sistem ini? Kirimkan pesan, kami akan membalas melalui email.",
  "contact.emailLabel": "Email",
  "contact.researchLabel": "Riset",
  "contact.researchBody": "Text mining dan machine learning untuk deteksi hoaks berbahasa Indonesia & Inggris.",
  "Want to report a hoax or a wrong result? Use the <link>report form</link>; it gives you a report number.":
    "Ingin melaporkan hoaks atau hasil yang keliru? Gunakan <link>formulir laporan</link>; Anda akan mendapatkan nomor laporan.",

  /* ---- About ---- */
  "about.eyebrow": "Tentang Riset",
  "about.title.a": "Hoax Analyzer,",
  "about.title.b": "berikan saya hoaks",
  "about.intro":
    "Eksperimen ini bertujuan memilih algoritma terbaik untuk mengklasifikasikan berita hoaks dan bukan hoaks dalam bahasa Indonesia dan Inggris menggunakan metode text mining dan machine learning.",
  "about.a1.title": "Text Mining",
  "about.a1.body": "Penyaringan (filtering), penghapusan stopword, dan stemming untuk membersihkan teks sebelum klasifikasi.",
  "about.a2.title": "Machine Learning",
  "about.a2.body": "Membandingkan berbagai algoritma untuk memilih pengklasifikasi hoaks / bukan hoaks terbaik pada data ID & EN.",
  "about.a3.title": "Arsip Cek Fakta",
  "about.a3.body": "Setiap pemeriksaan dicocokkan dengan ribuan cek fakta yang sudah terbit, sehingga klaim yang pernah dibantah langsung dikenali, lengkap dengan buktinya.",
  "about.research.eyebrow": "Riset yang sedang berjalan",
  "about.research.title": "Deteksi Hoaks untuk Teks Berbahasa Indonesia dan Inggris",
  "about.research.body":
    "Riset yang sedang berjalan berfokus pada deteksi berita hoaks berbahasa Indonesia dengan menggabungkan pengklasifikasi yang dilatih dengan ribuan cek fakta yang sudah terbit dan pencarian di arsip itu sendiri, sehingga setiap hasil disertai referensi untuk memverifikasinya.",
  "about.tryDetector": "Coba Detektor →",
  "about.contactLine": "Kontak riset & info hoaks:",
  "About the Research": "Tentang Riset",
  "How Hoax Detection & Analyzer works, what its archive and training data contain, and where its limits are.":
    "Cara kerja Hoax Detection & Analyzer, isi arsip dan data latihnya, serta batas-batas kemampuannya.",
  "It reads text. A screenshot is turned into text on your device first, so blurry or stylized images can be misread; check the text before analyzing.":
    "Sistem ini membaca teks. Tangkapan layar diubah menjadi teks di perangkat Anda terlebih dahulu, sehingga gambar yang buram atau bergaya khusus bisa salah terbaca; periksa teksnya sebelum dianalisis.",
  "It compares your text with fact-checks published up to 2022. A brand-new claim may not be in the archive yet.":
    "Sistem ini membandingkan teks Anda dengan cek fakta yang terbit hingga tahun 2022. Klaim yang benar-benar baru mungkin belum ada di arsip.",
  "A verdict is a prediction, not proof, and cannot serve as legal evidence. Always read the fact-check it points to.":
    "Hasil adalah prediksi, bukan bukti, dan tidak dapat dijadikan barang bukti hukum. Selalu baca cek fakta yang dirujuknya.",
  "Several source sites have closed or moved since their articles were collected. Their links open the Internet Archive's copy instead.":
    "Beberapa situs sumber sudah tutup atau pindah sejak artikelnya dikumpulkan. Tautannya akan membuka salinan dari Internet Archive.",
  "Indonesian and English are supported. Other languages are not analyzed reliably.":
    "Bahasa Indonesia dan Inggris didukung. Bahasa lain belum dapat dianalisis dengan andal.",
  "The archive": "Arsip",
  "{n} fact-checks, {years}": "{n} cek fakta, {years}",
  "{n} fact-checks": "{n} cek fakta",
  "Collected from {sources} fact-checking sources: {id} in Indonesian and {en} in English. Every entry keeps its verdict and a link to the original article.":
    "Dihimpun dari {sources} sumber cek fakta: {id} berbahasa Indonesia dan {en} berbahasa Inggris. Setiap entri menyimpan hasilnya dan tautan ke artikel aslinya.",
  Sources: "Sumber",
  "Training data": "Data latih",
  "{n} labeled examples": "{n} contoh berlabel",
  "The original detector learned from pages collected by its crawler, each labeled with the class the fact-checkers gave it.":
    "Detektor versi awal belajar dari halaman-halaman yang dikumpulkan oleh crawler-nya, masing-masing diberi label sesuai kelas yang ditetapkan para pemeriksa fakta.",
  "Another {n} collected pages were never labeled.": "Sebanyak {n} halaman lain yang terkumpul belum pernah diberi label.",
  Information: "Informasi",
  Disinformation: "Disinformasi",
  Fact: "Fakta",
  "How a check works": "Cara pemeriksaan berlangsung",
  "<b>1. Your text</b>: pasted, read from a link on the server, or read from a screenshot on your device.":
    "<b>1. Teks Anda</b>: ditempelkan, dibaca dari tautan di server, atau dibaca dari tangkapan layar di perangkat Anda.",
  "<b>2. The archive</b>: the rare words in your text are matched against every fact-check, so a claim that was debunked before is found even when it is worded differently.":
    "<b>2. Arsip</b>: kata-kata yang jarang dipakai dalam teks Anda dicocokkan dengan setiap cek fakta, sehingga klaim yang pernah dibantah tetap ditemukan meskipun kalimatnya berbeda.",
  "<b>3. The verdict</b>: comes from the trained detection model when it is connected. Until then, the closest matching fact-check decides, and a simple keyword check covers texts with no match; the result says which one answered.":
    "<b>3. Hasil</b>: berasal dari model deteksi terlatih jika model tersebut terhubung. Sebelum itu, cek fakta yang paling cocok yang menentukan, dan pemeriksaan kata kunci sederhana menangani teks yang tidak punya padanan; hasilnya menyebutkan mana yang menjawab.",
  Limits: "Batasan",
  "Browse the archive →": "Jelajahi arsip →",

  /* ---- Disclaimer: points 1–7 are the original Indonesian text of the old site ---- */
  "disclaimer.eyebrow": "Disclaimer",
  "disclaimer.title": "Baca ini sebelum menggunakannya.",
  "disclaimer.intro": "Sistem ini adalah alat bantu prediksi, bukan penentu kebenaran mutlak. Berikut ketentuannya.",
  "disclaimer.1": "Sistem ini masih dalam proses pengembangan.",
  "disclaimer.2":
    "Sistem ini hanya menerima input berupa artikel / berita / informasi dalam bentuk teks, jika ada informasi berbentuk gambar / file / video, diharuskan juga menyertakan deskripsi file terkait.",
  "disclaimer.3": "Sistem ini akan memberikan prediksi hoax berdasarkan analisis terhadap referensi yang ditemukan di basis data yang dimiliki Hoax Intel.",
  "disclaimer.4": "Sistem ini menyediakan artikel referensi yang relevan dengan masukan pengguna.",
  "disclaimer.5":
    "Hasil dari sistem ini hanya berupa sebuah prediksi, maka tidak dapat dijadikan barang bukti di pengadilan dan segala kerugian yang disebabkan oleh sistem ini tidak menjadi tanggung jawab pengembang.",
  "disclaimer.6":
    "Jika hasil dari sistem dianggap tidak benar, pengguna dapat melaporkannya melalui fitur pengaduan pada sistem. Sistem akan terus diperbaiki berdasarkan laporan pengguna dan verifikasi tim yang berwenang.",
  "disclaimer.7":
    "Agar memperoleh hasil yang lebih baik, pengguna disarankan untuk memberi masukan pada sistem yang berasal dari artikel / berita asli dari internet ataupun dari pesan terusan (forward) di media sosial.",
  "disclaimer.8":
    "Setiap penggunaan situs ini dicatat untuk keperluan riset, termasuk teks yang dikirim, hasilnya, alamat IP, jaringan, dan perangkat (lihat halaman Privasi). Jangan mengirimkan informasi pribadi atau rahasia.",
  "Last updated October 1, 2026. Questions: <mail>syyhoaxanalyzer@gmail.com</mail>":
    "Terakhir diperbarui 1 Oktober 2026. Pertanyaan: <mail>syyhoaxanalyzer@gmail.com</mail>",

  /* ---- Privacy ---- */
  "Privacy and research data": "Privasi dan data riset",
  "This site is also a research project: we study how people use a hoax detector. This page explains what is recorded when you use it.":
    "Situs ini juga merupakan proyek riset: kami mempelajari cara orang menggunakan detektor hoaks. Halaman ini menjelaskan apa saja yang dicatat saat Anda menggunakannya.",
  "What we record": "Apa yang kami catat",
  "Every check: the text or link you submit, the result, and when.": "Setiap pemeriksaan: teks atau tautan yang Anda kirim, hasilnya, dan waktunya.",
  "Your IP address, and the network it belongs to (internet provider or organization, and country), looked up in a public registry on our own server.":
    "Alamat IP Anda, beserta jaringan pemiliknya (penyedia internet atau organisasi, dan negara), yang dicari di registri publik dari server kami sendiri.",
  "Your browser's full identification string (User-Agent), device type, language, time zone, screen size, the website that linked you here and any campaign tags in the link.":
    "Identitas lengkap peramban Anda (User-Agent), jenis perangkat, bahasa, zona waktu, ukuran layar, situs yang mengarahkan Anda ke sini, dan tag kampanye pada tautannya.",
  "A random ID stored in your browser and one for each visit, so repeat visits can be counted without knowing your name.":
    "Sebuah ID acak yang disimpan di peramban Anda dan satu ID untuk setiap kunjungan, agar kunjungan berulang dapat dihitung tanpa mengetahui nama Anda.",
  "Your role and organization, only if you choose to tell us.": "Peran dan organisasi Anda, hanya jika Anda memilih untuk memberitahukannya.",
  "Reports and messages you send, with your name and e-mail if you give them, an optional screenshot, and the same technical details.":
    "Laporan dan pesan yang Anda kirim, beserta nama dan email jika Anda mencantumkannya, tangkapan layar opsional, dan detail teknis yang sama.",
  Why: "Mengapa",
  "To run and protect the service, to improve the detector, and for academic research on how people use a hoax detector. Research is published only as statistics or anonymized data. IP addresses, browser IDs and messages that could identify a person are never published.":
    "Untuk menjalankan dan melindungi layanan, menyempurnakan detektor, dan untuk riset akademis tentang cara orang menggunakan detektor hoaks. Hasil riset hanya diterbitkan dalam bentuk statistik atau data anonim. Alamat IP, ID peramban, dan pesan yang dapat mengungkap identitas seseorang tidak pernah diterbitkan.",
  "Who can see it": "Siapa yang dapat melihatnya",
  "Only the site's administrators. The records are kept on the site's own server; they are not sold, and the site uses no advertising or third-party trackers. When you send a report or a message, the administrators are notified by e-mail and Telegram with your name, e-mail and the start of the message. The site is reached through Cloudflare, which carries the connection.":
    "Hanya administrator situs. Catatan disimpan di server milik situs ini sendiri; catatan tersebut tidak dijual, dan situs ini tidak memakai iklan maupun pelacak pihak ketiga. Saat Anda mengirim laporan atau pesan, administrator diberi tahu melalui email dan Telegram beserta nama, email, dan awal pesan Anda. Situs ini diakses melalui Cloudflare, yang menyalurkan koneksinya.",
  "How long": "Berapa lama",
  "IP addresses are deleted {days} days after your visit, and the code derived from them is then scrambled so it cannot be traced back to the address. The network name, country, device type, checked text and result are kept for research. Reports and messages are kept until they have been dealt with and are then deleted on request.":
    "Alamat IP dihapus {days} hari setelah kunjungan Anda, lalu kode turunannya diacak sehingga tidak dapat dilacak kembali ke alamat tersebut. Nama jaringan, negara, jenis perangkat, teks yang diperiksa, dan hasilnya disimpan untuk riset. Laporan dan pesan disimpan sampai selesai ditangani, lalu dihapus atas permintaan.",
  "Records, including IP addresses, are kept for the duration of the research.": "Catatan, termasuk alamat IP, disimpan selama riset berlangsung.",
  "Your choices": "Pilihan Anda",
  "Don't paste personal information into the detector. To have your records deleted, write to <mail>syyhoaxanalyzer@gmail.com</mail> with the date and time of your checks and the browser ID below.":
    "Jangan menempelkan informasi pribadi ke detektor. Untuk menghapus catatan Anda, kirim email ke <mail>syyhoaxanalyzer@gmail.com</mail> dengan menyebutkan tanggal dan waktu pemeriksaan Anda serta ID peramban di bawah ini.",
  "Last updated October 8, 2026.": "Terakhir diperbarui 8 Oktober 2026.",
  "Browser ID:": "ID peramban:",
  none: "tidak ada",
  "Forget this browser": "Lupakan peramban ini",

  /* ---- Stats ---- */
  "stats.eyebrow": "Statistik",
  "stats.title": "Arsip dalam angka.",
  "stats.intro":
    "Berapa banyak cek fakta dalam arsip, siapa yang menerbitkannya, apa temuannya, dan seberapa sering detektor digunakan. Langsung dari basis data, diperbarui setiap sepuluh menit.",
  "The fact-check archive in numbers: entries per year, verdict, publisher and language, and how often the hoax detector is used.":
    "Arsip cek fakta dalam angka: entri per tahun, hasil, penerbit, dan bahasa, serta seberapa sering detektor hoaks digunakan.",
  "Fact-checks in the archive": "Cek fakta dalam arsip",
  "Published {from}–{to}": "Terbit {from}–{to}",
  "Published entries": "Entri yang sudah terbit",
  "Found to be a hoax": "Terbukti hoaks",
  "{n} entries": "{n} entri",
  "Fact-checking publishers": "Penerbit cek fakta",
  "Detector checks": "Pemeriksaan detektor",
  "Since {month}": "Sejak {month}",
  "Counted from the search log": "Dihitung dari log pencarian",
  "1 other site": "1 situs lainnya",
  "{n} other sites": "{n} situs lainnya",
  "1 entry has no date and is left out.": "1 entri tidak bertanggal dan tidak diikutkan.",
  "{n} entries have no date and are left out.": "{n} entri tidak bertanggal dan tidak diikutkan.",
  "Fact-checks per year": "Cek fakta per tahun",
  "By the year the fact-check was published, coloured by its verdict.": "Berdasarkan tahun terbit cek fakta, diwarnai menurut hasilnya.",
  "fact-checks": "cek fakta",
  "Entries per publisher": "Entri per penerbit",
  "The fact-checking sites the archive was collected from. Some entries keep the full text; others only the verdict and a link.":
    "Situs cek fakta yang menjadi sumber arsip. Sebagian entri menyimpan teks lengkapnya; sebagian lain hanya hasil dan tautannya.",
  "With full text": "Dengan teks lengkap",
  "Link only": "Hanya tautan",
  Verdicts: "Hasil",
  Languages: "Bahasa",
  "Text kept": "Teks yang disimpan",
  "Entries with the fact-check's own text can be searched and read here; link-only ones point to the original.":
    "Entri yang menyimpan teks cek faktanya dapat dicari dan dibaca di sini; entri yang hanya berupa tautan mengarah ke artikel aslinya.",
  "Full text": "Teks lengkap",
  "Detector checks per month": "Pemeriksaan detektor per bulan",
  "Texts and links submitted to the detector, {from} to {to}. Counts only; what people checked stays private.":
    "Teks dan tautan yang dikirim ke detektor, {from} sampai {to}. Hanya jumlahnya; isi yang diperiksa tetap dirahasiakan.",
  "Texts and links submitted to the detector. Counts only; what people checked stays private.":
    "Teks dan tautan yang dikirim ke detektor. Hanya jumlahnya; isi yang diperiksa tetap dirahasiakan.",
  "No checks logged yet.": "Belum ada pemeriksaan yang tercatat.",
  "Newest entries": "Entri terbaru",
  "The latest fact-checks with their full text.": "Cek fakta terbaru beserta teks lengkapnya.",
  "No entries yet.": "Belum ada entri.",
  "Where the numbers come from": "Asal angka-angka ini",
  "The archive numbers count the published entries of the <archive>fact-check archive</archive>, collected from public fact-checking sites such as TurnBackHoax (MAFINDO), Kominfo, CekFakta.com, Tempo and Hoax-Slayer; the year is the one the original fact-check was published. Detector checks are counted from the detector's search log, which the previous version of this site started in April 2019; only the number of checks is shown, never the texts. Everything on this page is read from the live database and refreshed every ten minutes. Read more <about>about the research</about> and <privacy>what is recorded</privacy>.":
    "Angka arsip menghitung entri yang sudah terbit di <archive>arsip cek fakta</archive>, yang dihimpun dari situs cek fakta publik seperti TurnBackHoax (MAFINDO), Kominfo, CekFakta.com, Tempo, dan Hoax-Slayer; tahunnya adalah tahun terbit cek fakta aslinya. Pemeriksaan detektor dihitung dari log pencarian detektor, yang dimulai oleh versi sebelumnya dari situs ini pada April 2019; yang ditampilkan hanya jumlah pemeriksaan, tidak pernah teksnya. Semua yang ada di halaman ini dibaca langsung dari basis data dan diperbarui setiap sepuluh menit. Baca selengkapnya <about>tentang riset ini</about> dan <privacy>apa saja yang dicatat</privacy>.",

  /* ---- Offline and error pages ---- */
  Offline: "Luring",
  "No connection right now": "Tidak ada koneksi saat ini",
  "Checking a message needs the internet, because it is compared with our fact-check archive. Try again once you are back online.":
    "Pemeriksaan pesan membutuhkan internet, karena pesan dibandingkan dengan arsip cek fakta kami. Silakan coba lagi setelah Anda kembali terhubung.",
  "Try again": "Coba lagi",
  Oops: "Ups",
  "Something went wrong on this page": "Terjadi kesalahan di halaman ini",
  "It is not you. Try again, and if it keeps happening, let us know and mention the code {code}.":
    "Ini bukan kesalahan Anda. Silakan coba lagi, dan jika masih terjadi, beri tahu kami dengan menyebutkan kode {code}.",
  "It is not you. Try again, and if it keeps happening, let us know.": "Ini bukan kesalahan Anda. Silakan coba lagi, dan jika masih terjadi, beri tahu kami.",
  "Back to Home": "Kembali ke Beranda",
  "Contact us": "Hubungi kami",
  "Hoax Analyzer is having trouble": "Hoax Analyzer sedang bermasalah",
  "The site could not load. Please try again in a moment (code {code}).": "Situs tidak dapat dimuat. Silakan coba lagi sebentar lagi (kode {code}).",
  "The site could not load. Please try again in a moment.": "Situs tidak dapat dimuat. Silakan coba lagi sebentar lagi.",
  "Page not found": "Halaman tidak ditemukan",
  "It may have been moved, or the link is wrong.": "Halaman ini mungkin sudah dipindahkan, atau tautannya salah.",
};
