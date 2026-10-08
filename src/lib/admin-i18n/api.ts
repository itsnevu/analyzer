/**
 * Indonesian for the messages the admin API answers with (src/app/api/admin),
 * keyed by the English text in the code. See ../admin-lang.
 *
 * The "From the libraries" part holds the fixed sentences of errors thrown by
 * lib code (PageError, LabError, ExtractError, UploadError and other
 * MessageErrors, see ../message-error) and the extractor's notes; the routes
 * translate those with t(err.key) or t(note), so no t("…") literal points at
 * them and the dictionary test cannot check them: keep them in step with the libs.
 */
export const api: Record<string, string> = {
  // Login
  "Admin login is turned off on this server. {problem}": "Login admin dimatikan di server ini. {problem}",
  "ADMIN_PASSWORD is missing or too weak (use at least 10 characters).": "ADMIN_PASSWORD belum diisi atau terlalu lemah (gunakan minimal 10 karakter).",
  "AUTH_SECRET is missing or too short (use a random string of at least 32 characters).":
    "AUTH_SECRET belum diisi atau terlalu pendek (gunakan teks acak minimal 32 karakter).",
  "Too many wrong passwords. Try again in 1 minute.": "Terlalu banyak percobaan kata sandi yang salah. Silakan coba lagi dalam 1 menit.",
  "Too many wrong passwords. Try again in {n} minutes.": "Terlalu banyak percobaan kata sandi yang salah. Silakan coba lagi dalam {n} menit.",
  "Wrong password.": "Kata sandi salah. Periksa lagi, lalu coba kembali.",
  "Enter the 6-digit code from your authenticator app.": "Masukkan kode 6 angka dari aplikasi autentikator Anda.",
  "Wrong or expired code. Wait for the next code and try again.": "Kode salah atau sudah kedaluwarsa. Tunggu kode berikutnya, lalu coba lagi.",

  // Shared answers
  "The request could not be read. Reload the page and try again.": "Permintaan tidak bisa dibaca. Muat ulang halaman, lalu coba lagi.",
  "This item was not found. It may have been deleted already; reload the page.": "Item ini tidak ditemukan. Mungkin sudah dihapus; silakan muat ulang halaman.",
  "This item could not be identified. Reload the page and try again.": "Item ini tidak dapat dikenali. Muat ulang halaman, lalu coba lagi.",
  "The item number is not valid. Reload the page and try again.": "Nomor item tidak valid. Muat ulang halaman, lalu coba lagi.",
  "This action is not known. Reload the page and try again.": "Tindakan ini tidak dikenal. Muat ulang halaman, lalu coba lagi.",
  "The action failed.": "Tindakan gagal dijalankan. Silakan coba lagi.",

  // Activity log
  "The last 7 days must always be kept. Choose 7 days or more.": "Catatan 7 hari terakhir harus selalu disimpan. Pilih 7 hari atau lebih.",

  // Articles
  "The article needs a title. Fill in the title and save again.": "Artikel perlu judul. Isi judulnya, lalu simpan lagi.",
  "The slug (web address) \"{slug}\" is already used by another article. Change the slug and save again.":
    "Slug (alamat) \"{slug}\" sudah dipakai artikel lain. Ubah slug-nya, lalu simpan lagi.",
  "Select at least one article first.": "Pilih minimal satu artikel terlebih dahulu.",
  "You can change at most {max} articles at a time. Select fewer and try again.":
    "Anda hanya bisa mengubah paling banyak {max} artikel sekaligus. Pilih lebih sedikit, lalu coba lagi.",
  "Choose a verdict first.": "Pilih putusannya terlebih dahulu.",
  "Write a title or the claim first.": "Tulis judul atau klaimnya terlebih dahulu.",
  "Searching the archive did not work. Please try again in a moment.": "Pencarian di arsip gagal. Silakan coba lagi sebentar lagi.",
  "That article no longer exists. It may have been deleted.": "Artikel itu sudah tidak ada. Mungkin sudah dihapus.",

  // Review queue and needs attention
  "Choose an article and a decision.": "Pilih artikel dan keputusannya.",
  "This group is not hidden, so there is nothing to bring back.": "Kelompok ini tidak disembunyikan, jadi tidak ada yang perlu dikembalikan.",

  // Dataset and reports
  "Choose one of the listed labels.": "Pilih salah satu label yang tersedia.",
  "Choose one of the listed statuses.": "Pilih salah satu status yang tersedia.",

  // Detection lab, extract, model
  "Paste a text or a link and choose a method.": "Tempel teks atau tautan, lalu pilih metodenya.",
  "The test run failed because of a problem on the server. Try again; if it keeps failing, check the server log.":
    "Uji coba gagal karena ada masalah di server. Silakan coba lagi; jika terus gagal, periksa log server.",
  "Paste a link, a page's HTML or the text of a message.": "Tempel tautan, kode HTML halaman, atau teks pesannya.",
  "That is too much text to read at once. Paste a shorter part.": "Teksnya terlalu panjang untuk dibaca sekaligus. Tempel bagian yang lebih pendek.",
  "Reading the page failed because of a problem on the server. Try again; if it keeps failing, check the server log.":
    "Halaman gagal dibaca karena ada masalah di server. Silakan coba lagi; jika terus gagal, periksa log server.",
  "The article and its source site are both needed.": "Artikel dan situs sumbernya harus diisi keduanya.",
  "That is not a valid site name.": "Nama situs itu tidak valid.",
  "No external model is configured (MODEL_API_URL is empty).": "Belum ada model eksternal yang diatur (MODEL_API_URL masih kosong).",
  "Type or paste some text to check.": "Ketik atau tempel teks yang ingin diperiksa.",
  "Paste at most {max} characters.": "Tempel paling banyak {max} karakter.",
  "There is no trained model yet. Train the model first.": "Belum ada model yang dilatih. Latih modelnya terlebih dahulu.",
  "The model knows none of the words in this text, so it gives no verdict (the keyword heuristic answers instead).":
    "Model tidak mengenali satu pun kata dalam teks ini, jadi model tidak memberi putusan (sebagai gantinya, pemeriksa kata kunci yang menjawab).",
  "Training failed.": "Pelatihan model gagal.",
  "no answer within {ms} ms": "tidak ada jawaban dalam {ms} ms",
  "MODEL_API_URL is not set": "MODEL_API_URL belum diisi",
  "the answer was not JSON": "jawabannya bukan JSON",
  "the answer did not match the contract": "jawabannya tidak sesuai format yang disepakati",
  "could not be reached": "tidak dapat dihubungi",

  // Settings and sources
  "Enter the HTML tag.": "Masukkan tag HTML-nya.",
  "This tag is already on the list. Edit that row instead.": "Tag ini sudah ada di daftar. Ubah baris yang sudah ada itu saja.",
  "Enter a domain, for example example.com.": "Masukkan domain, misalnya example.com.",
  "That is not a valid domain. Enter it like example.com.": "Domain itu tidak valid. Tulis seperti example.com.",
  "That domain is already on the list.": "Domain itu sudah ada di daftar.",
  "Choose one of the listed languages.": "Pilih salah satu bahasa yang tersedia.",
  "Enter at least one word.": "Masukkan minimal satu kata.",
  "Enter the web address (URL) of the site.": "Masukkan alamat web (URL) situsnya.",
  "Sources from the old panel cannot be deleted. Set the source to inactive instead.":
    "Sumber dari panel lama tidak bisa dihapus. Sebagai gantinya, ubah sumber itu menjadi tidak aktif.",

  // System
  "Another maintenance action is still running. Try again in a moment.": "Masih ada tindakan pemeliharaan lain yang berjalan. Silakan coba lagi sebentar lagi.",
  "Backup saved: {name} ({size}).": "Cadangan tersimpan: {name} ({size}).",
  "IP addresses are kept without a time limit (RESEARCH_IP_RETENTION_DAYS=0), so there is nothing to clear.":
    "Alamat IP disimpan tanpa batas waktu (RESEARCH_IP_RETENTION_DAYS=0), jadi tidak ada yang perlu dihapus.",
  "Cleared {count} expired IP addresses.": "{count} alamat IP yang sudah lewat masa simpannya telah dihapus.",
  "Search index rebuilt for {count} articles in {ms} ms.": "Indeks pencarian selesai dibangun ulang untuk {count} artikel dalam {ms} ms.",
  "Everyone is signed out, including you. Please sign in again.": "Semua orang sudah dikeluarkan, termasuk Anda. Silakan masuk lagi.",
  "Database optimized and compacted in {ms} ms: {before} → {after}.": "Database selesai dioptimalkan dan dipadatkan dalam {ms} ms: {before} → {after}.",
  "Statistics refreshed. Compacting (VACUUM) was skipped because the write-ahead log is still {size}. Try again when the site is quieter.":
    "Statistik sudah diperbarui. Pemadatan (VACUUM) dilewati karena log tulis (write-ahead log) masih {size}. Coba lagi saat situs sedang sepi.",

  // Uploads
  "The image is larger than 5 MB.": "Ukuran gambar lebih dari 5 MB. Pilih gambar yang lebih kecil.",
  "The upload could not be read. Choose the image again.": "Unggahan tidak bisa dibaca. Pilih gambarnya sekali lagi.",
  "Choose an image to upload.": "Pilih gambar yang akan diunggah.",
  "The image could not be saved. Try another image.": "Gambar tidak bisa disimpan. Coba gambar lain.",

  // From the libraries: reading a link (lib/fetch-page, lib/settings skip list)
  "That address is not a public website.": "Alamat itu bukan situs web publik, jadi tidak bisa dibaca.",
  "That is not a valid link.": "Tautan itu tidak valid. Periksa lagi tautannya.",
  "Only http and https links can be read.": "Hanya tautan http dan https yang bisa dibaca.",
  "Links with a user name or password are not accepted.": "Tautan yang berisi nama pengguna atau kata sandi tidak diterima.",
  "Only links on the standard web ports can be read.": "Hanya tautan pada port web standar yang bisa dibaca.",
  "The page took too long to load.": "Halaman terlalu lama dimuat. Coba lagi nanti, atau tempel saja teksnya.",
  "That page is too large to read.": "Halaman itu terlalu besar untuk dibaca.",
  "The page could not be reached.": "Halaman tidak dapat dibuka. Periksa tautannya atau coba lagi nanti.",
  "That site does not let us read the page (it may need a login).": "Situs itu tidak mengizinkan halamannya dibaca (mungkin perlu login).",
  "The page answered with an error ({status}).": "Halaman itu membalas dengan kesalahan ({status}).",
  "That link is not a web page.": "Tautan itu bukan halaman web.",
  "The link redirects too many times.": "Tautan itu dialihkan terlalu banyak kali.",
  "We could not find readable text on that page. Social media posts usually need a login; paste the text instead.":
    "Kami tidak menemukan teks yang bisa dibaca di halaman itu. Postingan media sosial biasanya perlu login; tempel saja teksnya.",
  "That site is on the skip list, so its pages are not read. Paste the text instead.":
    "Situs itu ada di daftar lewati, jadi halamannya tidak dibaca. Tempel saja teksnya.",
  "{host} is on the skip list (Settings → Skipped domains), so its pages are not read.":
    "{host} ada di daftar lewati (Pengaturan → Domain yang dilewati), jadi halamannya tidak dibaca.",

  // From the libraries: detection lab, uploads, system, model, dataset
  "Enter at least 15 characters, or one link.": "Masukkan minimal 15 karakter, atau satu tautan.",
  "Upload a PNG, JPEG, WebP or GIF image.": "Unggah gambar berformat PNG, JPEG, WebP, atau GIF.",
  "That file could not be read as an image.": "Berkas itu tidak bisa dibaca sebagai gambar. Coba gambar lain.",
  "The backup was not written.": "Cadangan gagal disimpan.",
  "Full-text search is not available in this Node build.": "Pencarian teks lengkap tidak tersedia di versi Node ini.",
  "Not enough published articles to train on ({count}).": "Artikel yang tayang belum cukup untuk melatih model ({count}).",
  "Dataset row not found.": "Baris dataset tidak ditemukan. Mungkin sudah dihapus.",
  "Already in the archive.": "Sudah ada di arsip.",
  "Already in the archive under the same link.": "Sudah ada di arsip dengan tautan yang sama.",
  "An article with this slug already exists.": "Sudah ada artikel dengan slug (alamat) ini.",

  // From the libraries: the extractor's notes (lib/extract)
  "No title found; the opening words are used instead.": "Judul tidak ditemukan; kata-kata pembukanya dipakai sebagai gantinya.",
  "No publication date found; today's date is used.": "Tanggal terbit tidak ditemukan; tanggal hari ini yang dipakai.",
  "No section headings found and the text reads like the message itself, so it is filed as the narration; write the fact-check under Explanation.":
    "Tidak ada judul bagian dan teksnya terbaca seperti pesan itu sendiri, jadi dimasukkan sebagai narasi; tulis cek faktanya di bagian Penjelasan.",
  "No NARASI / PENJELASAN headings found; the whole text is filed as the explanation.":
    "Judul bagian NARASI / PENJELASAN tidak ditemukan; seluruh teks dimasukkan sebagai penjelasan.",
  "The page has a narration but no explanation section.": "Halaman ini punya narasi, tetapi tidak punya bagian penjelasan.",
  "No verdict label such as [SALAH] or [KLARIFIKASI] in the title; \"Misleading\" is only a guess.":
    "Tidak ada label putusan seperti [SALAH] atau [KLARIFIKASI] di judul; \"Menyesatkan\" hanya tebakan.",
  "Unknown attachment.": "Lampiran tidak dikenal.",
};
