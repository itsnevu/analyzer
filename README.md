# Hoax Detection & Analyzer

The rebuild of [syyhoaxanalyzer.com](http://www.syyhoaxanalyzer.com/) (previously
WordPress plus a separate PHP detector) on **Next.js 16**, **React 19**,
**TypeScript**, **Tailwind CSS** and **SQLite**. People paste a message, a link
or a screenshot; the site finds matching fact-checks in an archive of about
11,000 of them and gives a verdict.

To put it on a server, follow **[DEPLOY.md](DEPLOY.md)**.

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000, admin at /admin (dev password: admin123)
```

Requires **Node 22.13+**: the database uses the built-in `node:sqlite` module.
`npm run dev` and `npm run build` first run `prepare:ocr`, which puts the
screenshot reader under `public/ocr/` (downloads ~4 MB of language data once).

## Commands

| Command | What it does |
|---------|--------------|
| `npm run dev` / `build` / `start` | Develop, build, serve |
| `npm run setup` | Creates `.env.local` with a strong admin password and session secret |
| `npm test` | Unit tests (vitest, `tests/`) |
| `npm run lint` | ESLint 9 with `eslint-config-next` |
| `npm run db:backup` | Consistent copy of the database to `data/backup/` |
| `npm run import:legacy` | Builds the fact-check archive from the legacy data (see below) |
| `npm run fetch:archived` / `apply:archived` | Recover text for dead turnbackhoax.id links from the Internet Archive |
| `npm run import:panel` | Loads the legacy detector panel's exports into the admin dashboard tables |

## Pages

| Route | Purpose |
|-------|---------|
| `/` | Paste box, archive search, a live example, how it works, tips, FAQ |
| `/detector` | The tool: text, a link, or a screenshot → verdict, matching fact-checks, highlighted risk phrases, share, "this result is wrong" |
| `/blog` | Archive: search, verdict / language / source / year filters, topics, pages |
| `/blog/[slug]` | One fact-check: claim, findings, sources, references, related fact-checks, share image |
| `/report` | Report a hoax, a wrong result or an article error (optional screenshot); returns a report number |
| `/contact`, `/about`, `/disclaimer`, `/offline` | Contact form; archive and training-data figures; terms; offline page for the installed app |
| `/admin` | Dashboard, articles (search, hidden drafts, image upload), reports inbox (status, unread, replies) |

## How a check works

1. **Input.** Pasted text; a link, which the server reads (public http(s) sites
   only; local-network addresses are refused, see [`src/lib/fetch-page.ts`](src/lib/fetch-page.ts));
   or a screenshot, read in the browser with tesseract.js so the image never
   leaves the device ([`src/lib/ocr.ts`](src/lib/ocr.ts)).
2. **Archive match.** The text's rare words are matched against every fact-check
   with SQLite full-text search ([`findSimilarArticles`](src/lib/articles.ts)).
3. **Verdict.** From the trained model when `RAG_FUSION_API_URL` is set. Its
   request/response contract is documented at the top of
   [`src/lib/detect.ts`](src/lib/detect.ts); a model that is down, slow or out of
   contract makes the site fall back to demo mode, visibly. In demo mode the top
   archive match decides, and a keyword heuristic covers texts with no match.

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
has edited. The remaining ~1,500 link-only entries are from stophoax.id (whose
article pages the Archive mostly did not save) and from Tempo and Kompas, which
block automated downloads.

Uploads (article covers, report screenshots) are re-encoded to strip EXIF and
location data and stored in `data/uploads/`.

## Security

- Admin login refuses the development defaults in production; `npm run setup`
  generates strong values. Five wrong passwords pause login for 15 minutes.
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

## Attribution

🤖 Generated with [Claude Code](https://claude.com/claude-code)
