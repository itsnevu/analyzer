# Hoax Detection & Analyzer — Next.js redesign

A ground-up rebuild of [syyhoaxanalyzer.com](http://www.syyhoaxanalyzer.com/)
(previously WordPress + VMagazine Lite theme) using **Next.js App Router**,
**TypeScript**, and **Tailwind CSS**, in a **dark neumorphism** design language.
The core hoax-check tool takes cues from the polished, dark, section-driven
layout of [useverdex.xyz](https://useverdex.xyz/).

## Quick start

```bash
npm install
npm run dev
# open http://localhost:3000
```

Requires Node 22.13+ (the database uses the built-in `node:sqlite` module).

## Database

Articles and report/contact submissions live in a SQLite file, `data/hoax.db`
(override with `DATABASE_PATH`). It is created on first run and seeded from
`content/articles.json` if present, otherwise from the `ARTICLES` array in
[`src/lib/data.ts`](src/lib/data.ts). Schema: [`src/lib/db.ts`](src/lib/db.ts).

## Legacy archive import

The fact-check archive (about 11,000 entries, 2000–2022) comes from the old site:

| File | What it is |
|------|------------|
| `data/legacy-wp/posts/*.json` | Public WordPress posts, fetched from `?rest_route=/wp/v2/posts` (full text, up to April 2019) |
| `data/legacy-panel/panel/hoax-master-data-categorized.json` | The old detector's labeled dataset, exported from `/adminpanel/` (authoritative labels, up to 2022) |

```bash
npm run import:legacy -- --dry   # show what would change
npm run import:legacy            # write it
```

The cleaner ([`scripts/legacy-clean.ts`](scripts/legacy-clean.ts)) strips each source
site's page chrome, repairs broken characters, recovers claim / explanation /
reference sections, and dates. Duplicates across sources are dropped. Entries
with only a title and verdict are published as link-only pages (noindex, not in
the sitemap). The import is safe to re-run: an article edited in the admin panel
is never overwritten. Back up `data/hoax.db` first.

## Install as an app

The site ships a web app manifest ([`src/app/manifest.ts`](src/app/manifest.ts)) and a
small service worker ([`public/sw.js`](public/sw.js), registered in production only).
Once served over HTTPS it can be installed from the browser; on Android the
installed app appears in the share sheet, so a WhatsApp message can be shared
straight into the detector (`/detector?text=…`).

## Self-hosting

```bash
cp .env.local.example .env.local   # set ADMIN_PASSWORD and AUTH_SECRET
npm ci
npm run build
npm run start                      # serves on port 3000
```

Keep it running with a process manager (pm2, systemd, NSSM on Windows) and put
it behind an HTTPS reverse proxy — the admin session cookie is only sent over
HTTPS in production. Back up `data/hoax.db` (plus its `-wal`/`-shm` files).

## Pages

| Route | Purpose |
|-------|---------|
| `/` | Home — hero, stats, how-it-works, comparison, recent fact-checks, FAQ, CTA |
| `/detector` | **The core tool.** Paste text → language auto-detect → verdict + confidence + references |
| `/blog` | Fact-check archive listing |
| `/blog/[slug]` | Article template (bilingual: Kategori/Sumber/Narasi/Penjelasan/Referensi) |
| `/disclaimer` | Terms of use (from the original ID disclaimer) |
| `/report` | Report a hoax / flag a wrong result |
| `/contact` | Contact form |
| `/about` | Research overview (text-mining, ML, RAG Fusion) |

API routes: `POST /api/detect` (detection seam) and `POST /api/report`.

## Connecting the real RAG Fusion backend

The detection logic lives in [`src/lib/detect.ts`](src/lib/detect.ts). Out of the
box it runs a **transparent local heuristic stub** (clearly flagged as "demo
mode" in the UI) so the whole interface is demonstrable without a backend.

> **Important:** the research build at `rag-fusion.streamlit.app` is a Streamlit
> Community Cloud app. Streamlit does **not** expose a JSON/REST API — it drives
> its own frontend over a websocket, so you can't `fetch()` it as an API.

To wire a real backend:

1. Put an HTTP endpoint in front of the same RAG pipeline (e.g. FastAPI/Flask)
   that accepts `POST { text, lang }` and returns the `DetectionResult` shape.
2. Set `RAG_FUSION_API_URL` in `.env.local` (see `.env.local.example`).
3. That's it — `runDetection()` switches to the real backend automatically.

## Design system

Dark neumorphism, tokenized in [`src/app/globals.css`](src/app/globals.css) and
[`tailwind.config.ts`](tailwind.config.ts):

- **Surface** `#202429` base, with paired `--shadow-dark` / `--shadow-light`
  so both the extruded shadow and highlight read (the essence of neumorphism).
- **Brand gradient** violet `#7c5cff` → cyan `#22d3ee`.
- **Verdict semantics** green (credible) / amber (misleading) / rose (hoax).
- Utilities: `.neu`, `.neu-inset`, `.neu-btn`, `.btn-primary`, `.eyebrow`,
  `.gradient-text`, and `shadow-neu*` in Tailwind.

## Security note (please read)

During data-gathering, the legacy `/adminpanel/` path appeared to be reachable.
**This redesign does not touch it, and you shouldn't either.** If an admin
backend is publicly accessible without authentication, that is a serious
vulnerability — report it to the site owner so it can be locked down. Pull real
data through legitimate admin credentials, not an exposed URL.

## Content migration

The original archive holds 8,300+ fact-check posts (5,969 ID + 2,331 EN). The
`ARTICLES` array in [`src/lib/data.ts`](src/lib/data.ts) ships a few real
examples in the target template. Full migration should import into a CMS or DB
and render through `/blog/[slug]`.

## Attribution

🤖 Generated with [Claude Code](https://claude.com/claude-code)
