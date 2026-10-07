import { SystemActionButton } from "@/components/admin/SystemPanel";
import { clsx } from "@/lib/clsx";
import { formatCount, formatDate } from "@/lib/sources";
import { backupsInfo, configInfo, COUNTED_TABLES, databaseInfo, filesInfo, formatAge, formatBytes, formatDuration, runtimeInfo, VACUUM_MAX_WAL_BYTES } from "@/lib/system";

export const dynamic = "force-dynamic";
export const metadata = { title: "System" };

const TABLE_NAMES: Record<(typeof COUNTED_TABLES)[number], string> = {
  articles: "Articles (archive)",
  reports: "Reports & messages",
  usage_log: "Research log rows",
  searches: "Searches",
  legacy_dataset: "Legacy dataset rows",
  stopwords: "Stopwords",
  admin_log: "Activity log entries",
};

const wib = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("en-GB", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" });
};

function Card({ title, note, children, className }: { title: string; note?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={clsx("neu p-5", className)}>
      <h2 className="font-display text-lg font-bold">{title}</h2>
      {note && <p className="mt-0.5 text-xs text-ink-faint">{note}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Rows({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="space-y-1.5 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-4 border-b border-hairline pb-1.5">
          <dt className="shrink-0 text-ink-muted">{label}</dt>
          <dd className="min-w-0 break-all text-right tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Chip({ tone, children }: { tone: "ok" | "warn" | "off"; children: React.ReactNode }) {
  return (
    <span
      className={clsx(
        "inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        tone === "ok" && "bg-verdict-valid/15 text-verdict-valid",
        tone === "warn" && "bg-verdict-warn/15 text-verdict-warn",
        tone === "off" && "bg-surface-sunken text-ink-faint",
      )}
    >
      {children}
    </span>
  );
}

const Mono = ({ children }: { children: React.ReactNode }) => <span className="font-mono text-xs">{children}</span>;

export default function SystemPage() {
  const rt = runtimeInfo();
  const db = databaseInfo();
  const backups = backupsInfo();
  const cfg = configInfo();
  const files = filesInfo();

  const walWarn = (db.walBytes ?? 0) > VACUUM_MAX_WAL_BYTES;
  const reclaimable = db.freePages * db.pageSize;
  const lowDisk = backups.freeDiskBytes !== null && backups.freeDiskBytes < 2 * Math.max(db.bytes ?? 0, 256 * 1024 * 1024);

  return (
    <div className="space-y-4">
      <div className="neu p-6">
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-[1.75rem]">System</h1>
        <p className="mt-2 max-w-3xl text-sm text-ink-muted">
          The server as it is right now: runtime, database, backups, which optional features are configured (never their secrets) and the
          data files the site needs. Maintenance actions run in place and are written to the activity log.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Runtime" note="This Node process">
          <Rows
            rows={[
              ["Node.js", <Mono key="n">{rt.node}</Mono>],
              ["Next.js", <Mono key="x">{rt.next}</Mono>],
              ["Environment", <Chip key="e" tone={rt.env === "production" ? "ok" : "warn"}>{rt.env}</Chip>],
              ["Uptime", formatDuration(rt.uptimeSeconds)],
              ["Memory (RSS)", `${formatBytes(rt.rssBytes)} · heap ${formatBytes(rt.heapUsedBytes)}`],
              ["Platform", `${rt.platform} (${rt.arch})`],
              ["Machine", `${rt.hostname} · ${rt.cpus} CPU · ${formatBytes(rt.totalMemoryBytes)} RAM`],
              ["Process id", rt.pid],
            ]}
          />
        </Card>

        <Card title="Database" note="SQLite, opened through node:sqlite">
          <Rows
            rows={[
              ["File", <Mono key="f">{db.file}</Mono>],
              ["Size", `${formatBytes(db.bytes)} (${formatCount(db.pageCount)} pages of ${formatBytes(db.pageSize)})`],
              [
                "Write-ahead log",
                <span key="w">
                  {formatBytes(db.walBytes)} {walWarn && <Chip tone="warn">large</Chip>}
                </span>,
              ],
              ["Journal mode", <Mono key="j">{db.journalMode}</Mono>],
              ["Reclaimable by VACUUM", formatBytes(reclaimable)],
              ["Full-text search", <Chip key="fts" tone={db.fts ? "ok" : "warn"}>{db.fts ? "available" : "unavailable (LIKE fallback)"}</Chip>],
              ["Schema version", db.schemaVersion],
            ]}
          />
          <h3 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wider text-ink-faint">Row counts</h3>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-3">
            {COUNTED_TABLES.map((t) => (
              <div key={t} className="rounded-lg bg-surface-sunken px-3 py-2">
                <dd className="text-lg font-semibold tabular-nums">{db.counts[t] === null ? "—" : formatCount(db.counts[t] ?? 0)}</dd>
                <dt className="text-[11px] text-ink-muted">{TABLE_NAMES[t]}</dt>
              </div>
            ))}
          </dl>
        </Card>

        <Card title="Backups" note="SQLite's online backup; a daily copy is made in production (see src/instrumentation.ts)">
          <Rows
            rows={[
              ["Directory", <Mono key="d">{backups.dir}</Mono>],
              ["Kept", backups.keep === 0 ? <Chip key="k" tone="warn">turned off (DB_BACKUP_KEEP=0)</Chip> : `last ${backups.keep}`],
              [
                "Last backup",
                <span key="l">
                  {formatAge(backups.lastAgeMs)}{" "}
                  {backups.lastAgeMs > 2 * 86_400_000 && <Chip tone="warn">{Number.isFinite(backups.lastAgeMs) ? "stale" : "none yet"}</Chip>}
                </span>,
              ],
              [
                "Free disk space",
                <span key="f">
                  {formatBytes(backups.freeDiskBytes)} {lowDisk && <Chip tone="warn">low</Chip>}
                </span>,
              ],
              ["Backups in all", `${backups.files.length} files · ${formatBytes(backups.totalBytes)}`],
            ]}
          />
          {backups.files.length > 0 && (
            <ul className="mt-3 max-h-56 divide-y divide-hairline overflow-y-auto rounded-lg border border-hairline text-xs">
              {backups.files.map((f) => (
                <li key={f.name} className="flex items-center justify-between gap-3 px-3 py-1.5">
                  <span className="truncate font-mono" title={wib(f.at)}>{f.name}</span>
                  <span className="shrink-0 tabular-nums text-ink-muted">
                    {formatBytes(f.bytes)} · {formatAge(f.ageMs)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4">
            <SystemActionButton action="backup" label="Back up now" busyLabel="Copying…" primary />
          </div>
        </Card>

        <Card title="Maintenance" note="Each action is written to the activity log">
          <ul className="space-y-4 text-sm">
            <li className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="max-w-md">
                <div className="font-medium">Purge expired IP addresses</div>
                <p className="mt-0.5 text-xs text-ink-muted">
                  Clears research-log addresses older than the retention period
                  {cfg.ipRetentionDays ? ` (${cfg.ipRetentionDays} days)` : ""}. The network name, country and keyed hash stay. The hourly
                  job does this too; this runs it now.
                  {cfg.ipRetentionDays === 0 && " Retention is unlimited (RESEARCH_IP_RETENTION_DAYS=0), so there is nothing to clear."}
                </p>
              </div>
              <SystemActionButton
                action="purge-ips"
                label="Purge expired IPs now"
                busyLabel="Purging…"
                disabled={cfg.ipRetentionDays === 0}
                confirmText={`Clear every IP address recorded more than ${cfg.ipRetentionDays} days ago? This cannot be undone.`}
              />
            </li>
            <li className="flex flex-col gap-2 border-t border-hairline pt-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="max-w-md">
                <div className="font-medium">Rebuild search index</div>
                <p className="mt-0.5 text-xs text-ink-muted">
                  Re-reads every article into the full-text index (articles_fts). Use it if search results look stale or wrong after a
                  direct database change. A few seconds on the full archive.
                </p>
              </div>
              <SystemActionButton
                action="rebuild-index"
                label="Rebuild search index"
                busyLabel="Rebuilding…"
                disabled={!db.fts}
                confirmText="Rebuild the full-text index now? Searches answer slower for a few seconds."
              />
            </li>
            <li className="flex flex-col gap-2 border-t border-hairline pt-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="max-w-md">
                <div className="font-medium">Optimize database</div>
                <p className="mt-0.5 text-xs text-ink-muted">
                  Refreshes the query planner&apos;s statistics (PRAGMA optimize), checkpoints the write-ahead log and, when the log is under{" "}
                  {formatBytes(VACUUM_MAX_WAL_BYTES)}, rewrites the file with VACUUM to give back {formatBytes(reclaimable)} of free pages.
                  It may take a few seconds, during which writes wait.
                </p>
              </div>
              <SystemActionButton
                action="optimize"
                label="Optimize database"
                busyLabel="Optimizing…"
                confirmText="Optimize the database now? Writes pause for a few seconds while the file is rewritten."
              />
            </li>
          </ul>
        </Card>

        <Card title="Configuration" note="Read from the environment (.env.local); values that are secrets are shown only as set or not">
          <Rows
            rows={[
              [
                "Admin login",
                cfg.auth.problem ? (
                  <Chip key="a" tone="warn">disabled: {cfg.auth.problem}</Chip>
                ) : cfg.auth.devDefaults ? (
                  <Chip key="a" tone="warn">development defaults</Chip>
                ) : (
                  <Chip key="a" tone="ok">configured</Chip>
                ),
              ],
              ["Site URL", <Mono key="s">{cfg.siteUrl}</Mono>],
              ["Database path", cfg.databasePathSet ? <Mono key="d">DATABASE_PATH</Mono> : <span key="d" className="text-ink-muted">default (data/hoax.db)</span>],
              ["Backups kept", cfg.backupKeep === 0 ? <Chip key="b" tone="warn">off</Chip> : cfg.backupKeep],
              ["IP retention", cfg.ipRetentionDays === 0 ? <Chip key="r" tone="warn">unlimited</Chip> : `${cfg.ipRetentionDays} days`],
              [
                "External model",
                cfg.externalModel.configured ? (
                  <span key="m">
                    <Mono>{cfg.externalModel.host}</Mono> · {cfg.externalModel.timeoutMs} ms
                  </span>
                ) : (
                  <Chip key="m" tone="off">not configured (the trained classifier answers)</Chip>
                ),
              ],
              ["Telegram alerts", <Chip key="t" tone={cfg.telegram ? "ok" : "off"}>{cfg.telegram ? "configured" : "not configured"}</Chip>],
              [
                "E-mail alerts (SMTP)",
                cfg.smtp.configured ? <Mono key="e">{cfg.smtp.host}</Mono> : <Chip key="e" tone="off">not configured</Chip>,
              ],
              ["Report e-mail", cfg.reportEmail ? <Mono key="re">{cfg.reportEmail}</Mono> : <span key="re" className="text-ink-muted">—</span>],
            ]}
          />
        </Card>

        <Card title="Files" note="Data the site needs besides the database">
          <Rows
            rows={[
              [
                "Screenshot reader (OCR)",
                files.ocr.present ? (
                  <span key="o">
                    <Chip tone="ok">present</Chip> · {files.ocr.languages.join(", ")}
                  </span>
                ) : (
                  <Chip key="o" tone="warn">missing: run npm run prepare:ocr</Chip>
                ),
              ],
              ["OCR directory", <Mono key="od">{files.ocr.dir}</Mono>],
              [
                "Classifier model",
                files.model.present ? (
                  <span key="m">
                    <Chip tone="ok">present</Chip> · {formatBytes(files.model.bytes)}
                    {files.model.trainedAt && ` · trained ${wib(files.model.trainedAt)}`}
                    {files.model.docs !== null && ` on ${formatCount(files.model.docs)} docs`}
                  </span>
                ) : (
                  <Chip key="m" tone="warn">no model file: train one on the Model page</Chip>
                ),
              ],
              ["Model file", <Mono key="mp">{files.model.path}</Mono>],
              [
                "IPtoASN database",
                files.ipdb.file ? (
                  <span key="i">
                    <Chip tone="ok">present</Chip> · {files.ipdb.date ? formatDate(files.ipdb.date) : files.ipdb.file} · {formatBytes(files.ipdb.bytes)}
                  </span>
                ) : (
                  <Chip key="i" tone="warn">missing: run npm run prepare:ipdb</Chip>
                ),
              ],
              ["IPtoASN directory", <Mono key="id">{files.ipdb.dir}</Mono>],
            ]}
          />
        </Card>
      </div>
    </div>
  );
}
