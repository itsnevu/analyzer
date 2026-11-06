# Audit SEO — 6 November 2026

Cakupan: seluruh sembilan halaman publik utama lewat Firecrawl HTTP, robots.txt, sitemap.xml; tinjauan kode template artikel, pagination/filter arsip, admin, offline. Bukan crawl individual seluruh artikel. Tidak mengukur Core Web Vitals atau status Search Console.

| Halaman | Status HTTP | H1 | Deskripsi khusus | Canonical |
| --- | --- | --- | --- | --- |
| / | 200 | 1 | Ya | Belum |
| /detector | 200 | 1 | Ya | Belum |
| /blog | 200 | 1 | Ya | Belum |
| /stats | 200 | 1 | Ya | Ya |
| /about | 200 | 1 | Ya | Belum |
| /contact | 200 | 1 | Mewarisi beranda | Belum |
| /report | 200 | 1 | Mewarisi beranda | Belum |
| /privacy | 200 | 1 | Mewarisi beranda | Belum |
| /disclaimer | 200 | 1 | Mewarisi beranda | Belum |

Prioritas tinggi:
1. HTTPS: Firecrawl melaporkan kegagalan validasi sertifikat pada tujuh URL HTTPS. HTTP tetap berhasil disajikan tanpa redirect HTTPS pada URL hasil scrape. Verifikasi sertifikat dan konfigurasi host; jangan menganggap semua browser/crawler pasti mengalami kegagalan sama.
2. robots.txt live menunjuk https://syyhoaxanalyzer.com/sitemap.xml, sedangkan sitemap live berisi URL https://new.syyhoaxanalyzer.com. Selaraskan host tujuan yang memang ingin diindeks.
3. Tambahkan canonical spesifik per halaman. Jangan menetapkan canonical beranda untuk semua halaman.
4. Arsip dengan parameter pencarian/filter/pagination memakai metadata identik dan belum punya kebijakan indexing/canonical khusus. Bedakan pagination valid dari hasil pencarian/filter.

Prioritas berikutnya:
- Deskripsi unik Contact, Report, Privacy, Disclaimer.
- Open Graph/Twitter spesifik tiap halaman; mayoritas mewarisi judul umum root layout.
- Strategi bahasa: bahasa berubah lewat cookie pada URL sama; belum ada URL bahasa/hreflang. Default crawler en. Tentukan prioritas audiens Indonesia sebelum mengubah URL.
- Sitemap statis lastModified memakai waktu permintaan; artikel memakai tanggal publikasi, bukan updatedAt. Gunakan tanggal perubahan nyata atau hilangkan bila tidak diketahui.
- Artikel: kode menyediakan judul/deskripsi, canonical, gambar preview dinamis, ClaimReview dan BreadcrumbList; artikel link-only noindex dan dikeluarkan dari sitemap. Kualitas/relevansi isi arsip perlu audit terpisah; schema bukan jaminan rich result.
- Admin dan offline ditandai noindex di kode. Belum memeriksa akses admin dengan autentikasi.

Yang terkonfirmasi baik: sembilan halaman utama HTTP 200, satu H1 per halaman, judul tersedia, metadata dasar, robots tersedia, sitemap XML tersedia dengan 9.682 URL. Tidak ada bukti dari audit ini bahwa semua URL sudah terindeks atau memiliki ranking baik.

Sumber: .firecrawl/new.syyhoaxanalyzer.com*.md (hasil mentah Firecrawl); src/app/**/page.tsx; src/app/layout.tsx; src/app/robots.ts; src/app/sitemap.ts; src/lib/structured-data.ts; src/lib/articles.ts; next.config.mjs.

Rerun: workflow firecrawl-seo-audit; site http://new.syyhoaxanalyzer.com; keywords tidak ditentukan; output markdown.
