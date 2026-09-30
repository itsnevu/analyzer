# Deploying on a home server

This guide puts the site on your own machine (Linux or Windows) and serves it
over HTTPS at your domain. Budget about an hour the first time.

## 0. Before you switch the domain

**Lock the old site's detector panel.** On the old hosting, everything under
`/adminpanel/` answers without a login: its data grids (the labeled dataset
and the search log with visitor IP addresses) can be downloaded by anyone, and
the grids also accept edit and delete requests. Do one of these in the old
hosting's control panel now:

- cPanel → **Directory Privacy** → `public_html/adminpanel` → enable password
  protection, or
- add a file `public_html/adminpanel/.htaccess` containing `Require all denied`, or
- delete the `adminpanel` folder (its data is already copied to this project).

Also change the WordPress admin password.

## 1. What the server needs

- **Node.js 22.13 or newer** (24 LTS recommended). Check with `node -v`.
- About 2 GB of free disk space (the database is ~100 MB; 14 daily backups take ~1.4 GB).
- Internet access during the first build (it downloads ~4 MB of OCR language data once).

## 2. Copy the project

Copy the project folder to the server **without** `node_modules/` and `.next/`
(or push it to a private Git repository and clone it there).

Then copy the data, which is not in Git:

1. On the current machine run `npm run db:backup`. It writes a consistent copy to
   `data/backup/hoax-YYYYMMDD-HHMMSS.db` (timestamps are UTC).
2. On the server, put that file at `data/hoax.db`.
3. Copy `data/uploads/` too if you uploaded article images or received reports
   with screenshots.

The `data/legacy-*` and `data/originals/` folders are only needed to re-run the
imports; the site itself does not read them.

## 3. Configure

```bash
npm ci
npm run setup
```

`npm run setup` creates `.env.local` with a random admin password (it prints it
once, so write it down) and a random session secret. Open `.env.local` and check:

- `SITE_URL`: the public address, e.g. `https://syyhoaxanalyzer.com`.
- Optional: `RAG_FUSION_API_URL` for the trained model (see section 8),
  `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` or `SMTP_URL` +
  `REPORT_NOTIFY_EMAIL` to be told about new reports. `.env.local.example`
  explains each setting.

In production the admin login refuses to work until `ADMIN_PASSWORD` (10+
characters) and `AUTH_SECRET` (32+ characters) are set, so a forgotten setup
cannot leave the panel open with a default password.

## 4. Build and try it

```bash
npm run build
npm start -- -H 127.0.0.1
```

Open `http://127.0.0.1:3000` on the server. Stop it with Ctrl+C.

## 5. Keep it running

With [pm2](https://pm2.keymetrics.io/) (works on Linux and Windows):

```bash
npm install -g pm2
pm2 start ecosystem.config.cjs
pm2 save
```

- **Linux:** run `pm2 startup` and the command it prints, so the site starts at boot.
- **Windows:** `npm install -g pm2-windows-startup` then `pm2-startup install`.

The app listens on `127.0.0.1:3000` only. That is deliberate: the HTTPS proxy
below is the only way in, so nobody can reach the app directly or fake their
address to get around the rate limits.

## 6. HTTPS and the domain

Pick one.

### Option A: Cloudflare Tunnel (recommended for a home connection)

No router ports to open, your home IP stays private, and HTTPS is automatic.
The domain has to use Cloudflare DNS (free plan).

```bash
cloudflared tunnel login
cloudflared tunnel create hoax-analyzer
cloudflared tunnel route dns hoax-analyzer syyhoaxanalyzer.com
cloudflared tunnel run --url http://127.0.0.1:3000 hoax-analyzer
```

Then install it as a service (`cloudflared service install`) so it survives
reboots. See Cloudflare's "Create a locally-managed tunnel" guide for details.

### Option B: Caddy

Needs a public IP (or dynamic DNS) and ports 80 and 443 forwarded to the server.
A `Caddyfile` with:

```
syyhoaxanalyzer.com {
	reverse_proxy 127.0.0.1:3000
}
```

Caddy obtains and renews the certificate by itself.

After either option, check that `https://your-domain/` loads, that the admin
login works (the session cookie is only sent over HTTPS), and that your browser
offers to install the app.

## 7. Updating

```bash
git pull            # or copy the new files over
npm ci
npm run build
pm2 restart hoax-analyzer
```

Database changes are applied automatically when the server starts. Run
`npm run db:backup` before large updates.

## 8. Backups

The server copies the database once a day to `data/backup/` and keeps the last
14 (`DB_BACKUP_KEEP`). Those copies are on the same disk, so also copy
`data/backup/` somewhere else regularly (an external drive or cloud storage).

To restore: stop the site (`pm2 stop hoax-analyzer`), copy a backup to
`data/hoax.db`, delete `data/hoax.db-wal` and `data/hoax.db-shm` if present, and
start it again.

## 9. Connecting the trained model

Run the model as an HTTP service (e.g. FastAPI) on the same machine, then set
`RAG_FUSION_API_URL=http://127.0.0.1:8000/detect` in `.env.local` and restart.
The request and response format is documented at the top of
[`src/lib/detect.ts`](src/lib/detect.ts). If the model is slow, down, or answers
in the wrong format, the site keeps working in demo mode and says so on the
result.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| "Admin login is disabled on this server" | Run `npm run setup`, then `pm2 restart hoax-analyzer`. |
| Signed out right after logging in | The site must be opened over HTTPS; the session cookie is HTTPS-only. |
| "Read a screenshot" never finishes | Run `npm run prepare:ocr` (needs internet once), then rebuild. |
| Everyone shares one rate limit | The proxy is not passing the visitor address; use Cloudflare Tunnel or Caddy as above. |
| Port 3000 already in use | Change `-p 3000` in `ecosystem.config.cjs` and in the proxy settings. |
