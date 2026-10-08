/** Indonesian for the public site, keyed by a dictionary key (lib/dictionary) or the English text in the code. See ../site-lang. */
export const api: Record<string, string> = {
  // Shared by the public routes
  "Too many requests. Please slow down.": "Terlalu banyak permintaan. Mohon tunggu sebentar.",

  // /api/detect
  "Too many checks from your network. Please wait a moment and try again.":
    "Terlalu banyak pemeriksaan dari jaringan Anda. Mohon tunggu sebentar, lalu coba lagi.",
  "Text is too long.": "Teks terlalu panjang.",
  "Invalid JSON body.": "Isi permintaan tidak valid.",
  "That site is on the skip list, so its pages are not read. Paste the text instead.":
    "Situs itu ada dalam daftar pengecualian, jadi halamannya tidak dibaca. Silakan tempelkan teksnya saja.",
  "Too many links in a short time. Please wait a moment.": "Terlalu banyak tautan dalam waktu singkat. Mohon tunggu sebentar.",
  "The page could not be read.": "Halaman tidak dapat dibaca.",
  "You can paste the text of the message instead.": "Anda bisa menempelkan teks pesannya sebagai gantinya.",
  "Text is too short. Enter at least {n} characters to analyze.": "Teks terlalu pendek. Masukkan minimal {n} karakter untuk dianalisis.",
  "Text is too long. Paste at most {max} characters.": "Teks terlalu panjang. Tempelkan paling banyak {max} karakter.",
  "Failed to analyze the text. Please try again shortly.": "Gagal menganalisis teks. Silakan coba lagi beberapa saat lagi.",

  // Reading a pasted link (lib/fetch-page errors, translated in /api/detect)
  "That address is not a public website.": "Alamat itu bukan situs web publik.",
  "That is not a valid link.": "Itu bukan tautan yang valid.",
  "Only http and https links can be read.": "Hanya tautan http dan https yang dapat dibaca.",
  "Links with a user name or password are not accepted.": "Tautan yang memuat nama pengguna atau kata sandi tidak diterima.",
  "Only links on the standard web ports can be read.": "Hanya tautan pada port web standar yang dapat dibaca.",
  "The page took too long to load.": "Halaman terlalu lama dimuat.",
  "That page is too large to read.": "Halaman itu terlalu besar untuk dibaca.",
  "The page could not be reached.": "Halaman tidak dapat dijangkau.",
  "That site does not let us read the page (it may need a login).": "Situs itu tidak mengizinkan kami membaca halamannya (mungkin perlu login).",
  "The page answered with an error ({status}).": "Halaman itu mengembalikan kesalahan ({status}).",
  "That link is not a web page.": "Tautan itu bukan halaman web.",
  "The link redirects too many times.": "Tautan itu dialihkan terlalu banyak kali.",
  "We could not find readable text on that page. Social media posts usually need a login; paste the text instead.":
    "Kami tidak menemukan teks yang bisa dibaca di halaman itu. Unggahan media sosial biasanya perlu login; silakan tempelkan teksnya saja.",

  // /api/report (Report and Contact forms)
  "Too many submissions from your network. Please try again later.": "Terlalu banyak kiriman dari jaringan Anda. Silakan coba lagi nanti.",
  "The upload is too large.": "Berkas yang diunggah terlalu besar.",
  "Invalid form data.": "Data formulir tidak valid.",
  "Thank you.": "Terima kasih.",
  "Invalid email format.": "Format email tidak valid.",
  "Name, email, subject, and message are required.": "Nama, email, subjek, dan pesan wajib diisi.",
  "Paste the message, headline or link you are reporting (at least {n} characters).":
    "Tempelkan pesan, judul berita, atau tautan yang Anda laporkan (minimal {n} karakter).",
  "The screenshot could not be saved.": "Tangkapan layar tidak dapat disimpan.",
  "Failed to save. Please try again shortly.": "Gagal menyimpan. Silakan coba lagi beberapa saat lagi.",
  "Report {number} received. Thank you for helping fight hoaxes.": "Laporan {number} sudah kami terima. Terima kasih telah membantu melawan hoaks.",
  "Message received. We'll get back to you by email.": "Pesan Anda sudah kami terima. Kami akan membalas melalui email.",

  // Screenshot uploads (lib/uploads errors, translated in /api/report)
  "Upload a PNG, JPEG, WebP or GIF image.": "Unggah gambar PNG, JPEG, WebP, atau GIF.",
  "The image is larger than 5 MB.": "Ukuran gambar lebih dari 5 MB.",
  "That file could not be read as an image.": "Berkas itu tidak dapat dibaca sebagai gambar.",
};
