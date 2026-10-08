# Hoax Detection & Analyzer

The rebuild of [syyhoaxanalyzer.com](http://www.syyhoaxanalyzer.com/) (previously
WordPress plus a separate PHP detector) on **Next.js 16**, **React 19**,
**TypeScript**, **Tailwind CSS** and **SQLite**. People paste a message, a link
or a screenshot; the site finds matching fact-checks in an archive of about
11,000 of them and gives a verdict. The admin panel rebuilds every screen of the
old detector panel (detection lab, dataset, sources, settings, search log) on
the live data, plus a review queue, a page extractor and a trainable baseline
classifier.

To put it on a server, follow **[DEPLOY.md](DEPLOY.md)**.

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000 (this computer only), admin at /admin (dev password: admin123)
```

Requires **Node 22.13+**: the database uses the built-in `node:sqlite` module.
`npm run dev` and `npm run build` first run `prepare:ocr`, which puts the
screenshot reader under `public/ocr/` (downloads ~4 MB of language data once).

To run it in a container instead, `docker compose up -d --build` (see
[DEPLOY.md](DEPLOY.md), "Option: Docker"). GitHub Actions
([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs lint, type check,
tests and a production build on every push and pull request.

## Commands

| Command | What it does |
|---------|--------------|
| `npm run dev` / `build` / `start` | Develop, build, serve |
| `npm run setup` | Creates `.env.local` with a strong admin password and session secret (`-- --totp` turns on two-factor login, `-- --no-totp` off) |
| `npm test` | Unit tests (vitest, `tests/`) |
| `npm run lint` | ESLint 9 with `eslint-config-next` |
| `npm run db:backup` | Consistent copy of the database to `data/backup/` |
| `npm run import:legacy` | Builds the fact-check archive from the legacy data (see below) |
| `npm run fetch:archived` / `apply:archived` | Recover text for dead turnbackhoax.id links from the Internet Archive |
| `npm run fetch:commoncrawl` / `apply:commoncrawl` | Recover text for dead stophoax.id links from Common Crawl |
| `npm run import:panel` | Loads the legacy detector panel's exports (dataset, sources, search log, stopwords, HTML tags, skipped domains) into the admin tables |
| `npm run train:baseline` | Trains the baseline classifier on the archive into `data/models/baseline.json` (`--dry` only evaluates, `--compare` tries both text variants) |

## Pages

| Route | Purpose |
|-------|---------|
| `/` | Paste box, archive search, a live example, how it works, tips, FAQ |
| `/detector` | The tool: text, a link, or a screenshot → verdict, matching fact-checks, highlighted risk phrases, share, "this result is wrong" |
| `/blog` | Archive: search, verdict / language / source / year filters, topics, pages |
| `/blog/[slug]` | One fact-check: claim, findings, sources, references, related fact-checks, share image |
| `/report` | Report a hoax, a wrong result or an article error (optional screenshot); returns a report number |
| `/contact`, `/about`, `/disclaimer`, `/offline` | Contact form; archive and training-data figures; terms; offline page for the installed app |
| `/stats` | The archive in numbers: per year and verdict, per publisher, language, text coverage, detector use per month |
| `/feed.xml`, `/api/health`, `/api/suggest` | RSS feed of the newest fact-checks; health check for uptime monitors; search suggestions |
| `/admin` | Dashboard: article counts, the last 7 days (checks, visits, engines, archive coverage, top matches), which engine answers, the training dataset, searches |
| `/admin/articles`, `/admin/reports` | Articles (filters, sorting, bulk publish / hide / verdict / delete, CSV); reports inbox (filters, notes, resolve with an article, closest archive matches) |
| `/admin/detect`, `/admin/model` | Detection lab (six similarity algorithms); model status, ping, train, try |
| `/admin/extract`, `/admin/review`, `/admin/attention` | Turn a page or message into a draft article; give hidden entries a verdict; claims the archive could not answer |
| `/admin/dataset`, `/admin/sources`, `/admin/searches`, `/admin/research` | The old detector's dataset and source sites; the search log; the research log with IPs |
| `/admin/settings`, `/admin/system`, `/admin/activity` | Stopwords, HTML entity replacements, skipped domains; database, backups and maintenance; the log of changes made in the panel |

## How a check works

1. **Input.** Pasted text; a link, which the server reads (public http(s) sites
   only; local-network addresses are refused, see [`src/lib/fetch-page.ts`](src/lib/fetch-page.ts));
   or a screenshot, read in the browser with tesseract.js so the image never
   leaves the device ([`src/lib/ocr.ts`](src/lib/ocr.ts)).
2. **Archive match.** The text's rare words are matched against every fact-check
   with SQLite full-text search ([`findSimilarArticles`](src/lib/articles.ts)).
3. **Verdict.** The top archive match decides when there is one. Otherwise the
   site's own classifier (below) scores the text, or a keyword heuristic does
   until a classifier has been trained; only the heuristic is shown as demo
   mode. An external model over HTTP can be plugged in with `MODEL_API_URL`
   (contract at the top of [`src/lib/detect.ts`](src/lib/detect.ts)); its
   verdict is then final, and if it is down, slow or out of contract the local
   engines answer and the result says so.

**The classifier.** Multinomial logistic regression over TF-IDF words and word
pairs of the published fact-checks (the title without its tag plus the claim
narration), trained with `npm run train:baseline` into `data/models/baseline.json`
(about 2 MB, under two seconds; also from the admin Model page, and weekly by the production server when the archive changed, see `BASELINE_RETRAIN_DAYS`). On a stratified
10% holdout it reaches 74% accuracy and 0.60 macro-F1 (hoax F1 0.84, credible
0.62, misleading 0.35). It learns which claims fact-checkers have debunked or
confirmed, not whether a statement is true, so topics the archive only ever
debunked read as hoax-prone; that is why a matching archived fact-check always
overrides it. Function words and verdict words (hoaks, salah, fakta, …) are never
features, so the label cannot leak in from the fact-check wording
([`src/lib/baseline.ts`](src/lib/baseline.ts)).

Every visit, check, report and message is also written to a research log
(`usage_log`): IP address, network (from the public-domain IPtoASN database,
looked up locally; `npm run prepare:ipdb`), device, referrer and an optional
self-reported role. It is explained on `/privacy`, browsed and exported as CSV
at `/admin/research`, and IPs are cleared after `RESEARCH_IP_RETENTION_DAYS`.
`npm run import:usage` adds the old panel's search log (2019–2024, with IPs).

## Data

Everything lives in `data/hoax.db` (override with `DATABASE_PATH`); the schema
and its migrations are in [`src/lib/db.ts`](src/lib/db.ts) and run at start-up.
`data/` is not in Git.

The archive is built by `npm run import:legacy` from two sources:

| File | What it is |
|------|------------|
| `data/legacy-wp/posts/*.json` | Public WordPress posts from `?rest_route=/wp/v2/posts` (full text, up to April 2019) |
| `data/legacy-panel/panel/hoax-master-data-categorized.json` | The old detector's labeled dataset (authoritative labels, up to 2022) |

The cleaner ([`scripts/legacy-clean.ts`](scripts/legacy-clean.ts)) strips each
source site's page chrome, repairs broken characters, and recovers the claim,
explanation, references and date. Duplicates across sources are dropped. Entries
with only a title and verdict become link-only pages (noindex, not in the
sitemap). Re-running the import never overwrites an article edited in the admin
panel, nor text recovered later. Several source sites have since closed or moved
(stophoax.id is now a parked domain; turnbackhoax.id changed its URLs); links to
them open the Internet Archive's copy instead ([`src/lib/sources.ts`](src/lib/sources.ts)).

For the old turnbackhoax.id links, `npm run fetch:archived` downloads the
Internet Archive's copies (to `data/originals/`, about 1,300 pages) and
`npm run apply:archived` turns them into article text; the article page credits
the copy it came from. After a change to the cleaner, `npm run import:legacy`
followed by `npm run apply:archived -- --refresh` rebuilds everything that nobody
has edited.

The Wayback Machine never saved most stophoax.id article pages, but Common Crawl
visited the site in 2019–2020. `npm run fetch:commoncrawl` reads its index for
2018–2022 (cached under `data/originals/commoncrawl/index`), downloads the WARC
record of every link-only stophoax.id page that was captured (to
`data/originals/stophoax`), and `npm run apply:commoncrawl` turns the pages into
article text, crediting the Common Crawl index record in `archiveUrl`. Common
Crawl only ever captured about 520 of the site's posts, 58 of them among our
link-only entries; those are recovered. `--list-only` reports coverage,
`--dry` / `--limit N` trial a run, `--refresh` redoes recovered text after a
cleaner change. The remaining ~1,470 link-only entries are 1,210 from
stophoax.id and the Tempo and Kompas pages, which block automated downloads.

Uploads (article covers, report screenshots) are re-encoded to strip EXIF and
location data and stored in `data/uploads/`.

## Admin panel

The panel keeps the old control panel's layout, a dark side rail with the menu
grouped as Detector, Content, Data and Settings, and modernises it: the rail
collapses to icons (and becomes a drawer on phones), a sticky top bar shows the
breadcrumb, badges count unread reports, hidden entries and open "needs
attention" claims, and **Ctrl+K** opens a palette that jumps to any page or
straight to an article. List pages share one data grid in the spirit of the old
jqGrid tables: a filter row under the headers, sortable columns, zebra rows,
row selection and a pager with "View a–b of N", with every state in the URL.

**Dashboard.** Archive totals by verdict, the last 7 days from the research
log (checks, visits, reports, browsers, checks per day for 30 days, which
engine answered, how many checks the archive could answer, the fact-checks it
answered with most), the detector engine's status, the old detector's training
dataset and the search history.

**Needs attention** (`/admin/attention`) groups the claims people checked that
the archive had no fact-check for (near-duplicates merged), most checked first,
with "create draft" and "open in lab" buttons; two more tabs list archive
matches that disagree with the model and checks the model was unsure about.
**System** (`/admin/system`) shows the runtime, database, backups (with "back
up now"), configuration without secrets and data files, and runs maintenance:
purge expired IPs, rebuild the search index, optimize the database.
**Activity log** (`/admin/activity`) records every change made in the panel
(articles, review, dataset, settings, sources, training, reports, logins, bulk
and system actions) with filters and CSV export.

**Detector tools.** *Detection lab* (`/admin/detect`) scores a text or a link
against the archive with a chosen algorithm (the public detector's BM25 +
rare-word match, Levenshtein, Damerau–Levenshtein, Smith–Waterman, Jaccard or
TF-IDF cosine; [`src/lib/similarity.ts`](src/lib/similarity.ts)), using the
stopword lists from Settings, and shows each stage's timing next to the verdict
the detector itself gives; lab runs are never written to the search statistics
or the research log. *Model* (`/admin/model`) shows which engine answers public
checks (external model → baseline → keyword heuristic), pings the external
model, trains the baseline in place and tries a text. *Searches*
(`/admin/searches`) is the full search log (legacy panel + this site) with
filters, delete and CSV export; IP and device data live in `/admin/research`.

**Content tools.** *Extract from a page* (`/admin/extract`) turns a fact-check
link, pasted HTML or a forwarded message into article fields (title, verdict
from the `[SALAH]` / `[KLARIFIKASI]` tag, date, narration, explanation,
references, source site), lists fact-checks already in the archive about the
same claim, and saves the result as a hidden draft or a published article
([`src/lib/extract.ts`](src/lib/extract.ts)). *Review queue* (`/admin/review`)
walks through the articles imported without a verdict from their publisher, one
at a time, with keyboard shortcuts to publish them as hoax, misleading or
credible, keep them hidden, or delete them.

**Data pages.** `/admin/dataset` browses the old detector's 17,126-row training
dataset (categorized / uncategorized tabs, filters by label, title, source site,
year and archive status, CSV export). A label changed there wins over the
imported one everywhere, and "Add to archive" turns a row into a fact-check
entry the same way `npm run import:legacy` does (text from
`data/legacy-panel/panel/` when present). `/admin/sources` lists the 23 sites
the old crawler collected from with dataset and archive counts, lets you add,
edit or deactivate them, and shows the listing pages the crawler used.
`/admin/settings` holds the detector's stopwords per language (en / id / ms),
the HTML entity replacements applied when text is extracted from a page, and
the skip list of domains the detector and the extract tool refuse to fetch. All
of these are filled by `npm run import:panel`, which can be re-run without
losing what was added in the admin panel.

**Public extras.** Every article page with its own text carries schema.org
`ClaimReview` and `BreadcrumbList` JSON-LD, so search engines can show the
verdict as a fact-check. The home page and the archive show the fact-checks
opened most in the last 30 days (the newest ones while the visit log is thin),
and the navbar search box suggests matching fact-checks as you type.

## Security

- Admin login refuses the development defaults in production; `npm run setup`
  generates strong values. Five wrong passwords pause login for 15 minutes.
- Optional two-factor login: `npm run setup -- --totp` sets `ADMIN_TOTP_SECRET`
  and prints a QR code for an authenticator app; login then also asks for the
  6-digit code (each code works once; wrong codes count as failed logins).
- Per-address rate limits on the detector, links, reports and the public API.
- Content-Security-Policy and related headers ([`next.config.mjs`](next.config.mjs)).
- The legacy site's `/adminpanel/` is open to anyone; lock it before switching
  the domain (see [DEPLOY.md](DEPLOY.md), step 0).

## Design

A light editorial look, tokenized in [`src/app/globals.css`](src/app/globals.css)
and [`tailwind.config.ts`](tailwind.config.ts): warm off-white surfaces
(`--surface #faf9f6`), ink text (`--ink #191817`), a teal brand (`--brand #0f766e`),
verdict colours green (credible) / amber (misleading) / red (hoax), Fraunces for
headings and Geist for text. The UI is English-only; archive articles keep their
original language.

The site follows the system colour scheme; the round button in the navbar (and
in the mobile menu and the admin sidebar) cycles System → Light → Dark. The
choice is kept in `localStorage("theme")` and applied by an inline script before
the first paint, so there is no flash. Every colour is a CSS token with a light
and a dark set (RGB triplets, so Tailwind's `bg-x/50` tints work).

`/feed.xml` is an RSS 2.0 feed of the 50 newest fact-checks that have text of
their own: title, verdict as the category, summary and publisher, linking to the
article page. It is advertised in the page head and linked from the footer, and
is cached for ten minutes.

## Attribution

🤖 Generated with [Claude Code](https://claude.com/claude-code)
