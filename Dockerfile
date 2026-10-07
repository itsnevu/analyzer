# syntax=docker/dockerfile:1
#
# Production image: Next.js standalone server on Node 22, data in a volume.
#   docker compose up -d --build        (see docker-compose.yml and DEPLOY.md)
# The database, uploads, trained model and backups live in /app/data; mount it.

# --- Dependencies ---------------------------------------------------------
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- Build ----------------------------------------------------------------
FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 \
    # next.config.mjs switches to output: "standalone" on this.
    NEXT_OUTPUT=standalone \
    # The IP-to-network database belongs in the data volume, not the image:
    # run `npm run prepare:ipdb` in the container once instead (DEPLOY.md).
    SKIP_IPDB=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# prebuild puts the screenshot reader in public/ocr (downloads ~4 MB of language data).
RUN npm run build

# --- Runtime --------------------------------------------------------------
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    NEXT_TELEMETRY_DISABLED=1

# The server: traced files and node_modules subset, plus what it serves itself.
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
# Share-preview images read the Geist TTFs from node_modules at run time.
COPY --from=build --chown=node:node /app/node_modules/geist/dist/fonts/geist-sans ./node_modules/geist/dist/fonts/geist-sans

# Maintenance commands that only need Node built-ins, so they run in this image:
#   docker compose exec app npm run train:baseline
#   docker compose exec app npm run db:backup
#   docker compose exec app npm run prepare:ipdb
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/scripts/train-baseline.ts /app/scripts/backup-db.ts /app/scripts/prepare-ipdb.ts ./scripts/
COPY --from=build --chown=node:node /app/src/lib/db.ts /app/src/lib/baseline.ts /app/src/lib/backup.ts /app/src/lib/ip-asn.ts ./src/lib/

RUN mkdir -p /app/data && chown node:node /app/data
# The image's built-in unprivileged user (uid 1000).
USER node
VOLUME ["/app/data"]
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]

CMD ["node", "server.js"]
