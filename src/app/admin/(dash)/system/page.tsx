import type { Metadata } from "next";
import { SystemActionButton } from "@/components/admin/SystemPanel";
import { adminLocale, formatAdminDateTime, formatAdminNumber, tk, type AdminLang } from "@/lib/admin-lang";
import { getAdminT } from "@/lib/admin-lang-server";
import { clsx } from "@/lib/clsx";
import { backupsInfo, configInfo, COUNTED_TABLES, databaseInfo, filesInfo, formatAge, formatBytes, formatDuration, runtimeInfo, VACUUM_MAX_WAL_BYTES } from "@/lib/system";
import { requireAdmin } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAdminT();
  return { title: t("System") };
}

const TABLE_NAMES: Record<(typeof COUNTED_TABLES)[number], string> = {
  articles: tk("Articles (archive)"),
  reports: tk("Reports & messages"),
  usage_log: tk("Research log rows"),
  searches: tk("Searches"),
  legacy_dataset: tk("Old dataset rows"),
  stopwords: tk("Common words (stopwords)"),
  admin_log: tk("Activity log entries"),
};

/** "9 Oct 2026" / "9 Okt 2026" for a "YYYY-MM-DD" date. */
const day = (date: string, lang: AdminLang) => {
  const d = new Date(`${date}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? date : d.toLocaleDateString(adminLocale(lang), { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
};

function Card({ title, note, children, className }: { title: string; note?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={clsx("neu p-5", className)}>
      <h2 className="font-display text-lg font-bold">{title}</h2>
      {note && <p className="mt-0.5 text-sm text-ink-faint">{note}</p>}
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
        "inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider",
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

export default async function SystemPage() {
  await requireAdmin();
  const { t, lang } = await getAdminT();
  const n = (v: number) => formatAdminNumber(v, lang);
  const bytes = (v: number | null | undefined) => formatBytes(v, lang);
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
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-[1.75rem]">{t("System")}</h1>
        <p className="mt-2 max-w-3xl text-sm text-ink-muted">
          {t(
            "How the server is doing right now: the program, the database, backups, which optional features are set up (never their secrets) and the data files the site needs. The maintenance buttons run right away and are written to the activity log.",
          )}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={t("Server program")} note={t("The Node.js process that runs the site")}>
          <Rows
            rows={[
              ["Node.js", <Mono key="n">{rt.node}</Mono>],
              ["Next.js", <Mono key="x">{rt.next}</Mono>],
              [
                t("Mode"),
                <Chip key="e" tone={rt.env === "production" ? "ok" : "warn"}>
                  {rt.env === "production" ? t("Live (production)") : rt.env === "development" ? t("Development") : rt.env}
                </Chip>,
              ],
              [t("Running for"), formatDuration(rt.uptimeSeconds, t)],
              [t("Memory in use"), t("{total} (JavaScript heap {heap})", { total: bytes(rt.rssBytes), heap: bytes(rt.heapUsedBytes) })],
              [t("Operating system"), `${rt.platform} (${rt.arch})`],
              [t("Computer"), `${rt.hostname} · ${n(rt.cpus)} CPU · ${bytes(rt.totalMemoryBytes)} RAM`],
              [t("Process ID"), rt.pid],
            ]}
          />
        </Card>

        <Card title={t("Database")} note={t("One SQLite file that holds all the site's data")}>
          <Rows
            rows={[
              [t("File"), <Mono key="f">{db.file}</Mono>],
              [t("Size"), t("{size} ({pages} pages of {pageSize})", { size: bytes(db.bytes), pages: db.pageCount, pageSize: bytes(db.pageSize) })],
              [
                t("Changes waiting to be merged (WAL)"),
                <span key="w">
                  {bytes(db.walBytes)} {walWarn && <Chip tone="warn">{t("Large")}</Chip>}
                </span>,
              ],
              [t("Journal mode"), <Mono key="j">{db.journalMode}</Mono>],
              [t("Unused space to give back (VACUUM)"), bytes(reclaimable)],
              [
                t("Fast word search (FTS)"),
                <Chip key="fts" tone={db.fts ? "ok" : "warn"}>
                  {db.fts ? t("Available") : t("Unavailable (a slower search is used)")}
                </Chip>,
              ],
              [t("Database structure version"), db.schemaVersion],
            ]}
          />
          <h3 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wider text-ink-faint">{t("Rows per table")}</h3>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-3">
            {COUNTED_TABLES.map((table) => (
              <div key={table} className="rounded-lg bg-surface-sunken px-3 py-2">
                <dd className="text-lg font-semibold tabular-nums">{db.counts[table] === null ? "—" : n(db.counts[table] ?? 0)}</dd>
                <dt className="text-xs text-ink-muted">{t(TABLE_NAMES[table])}</dt>
              </div>
            ))}
          </dl>
        </Card>

        <Card title={t("Backups")} note={t("Copies of the database. On the live server a copy is made every day (see src/instrumentation.ts).")}>
          <Rows
            rows={[
              [t("Folder"), <Mono key="d">{backups.dir}</Mono>],
              [
                t("Copies kept"),
                backups.keep === 0 ? (
                  <Chip key="k" tone="warn">
                    {t("Turned off (DB_BACKUP_KEEP=0)")}
                  </Chip>
                ) : (
                  t("The last {n}", { n: backups.keep })
                ),
              ],
              [
                t("Last backup"),
                <span key="l">
                  {formatAge(backups.lastAgeMs, t)}{" "}
                  {backups.lastAgeMs > 2 * 86_400_000 && <Chip tone="warn">{Number.isFinite(backups.lastAgeMs) ? t("Out of date") : t("None yet")}</Chip>}
                </span>,
              ],
              [
                t("Free disk space"),
                <span key="f">
                  {bytes(backups.freeDiskBytes)} {lowDisk && <Chip tone="warn">{t("Low")}</Chip>}
                </span>,
              ],
              [t("All backups"), t("{n} files · {size}", { n: backups.files.length, size: bytes(backups.totalBytes) })],
            ]}
          />
          {backups.files.length > 0 && (
            <ul className="mt-3 max-h-56 divide-y divide-hairline overflow-y-auto rounded-lg border border-hairline text-sm">
              {backups.files.map((f) => (
                <li key={f.name} className="flex items-center justify-between gap-3 px-3 py-1.5">
                  <span className="truncate font-mono text-xs" title={formatAdminDateTime(f.at, lang)}>
                    {f.name}
                  </span>
                  <span className="shrink-0 tabular-nums text-ink-muted">
                    {bytes(f.bytes)} · {formatAge(f.ageMs, t)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4">
            <SystemActionButton action="backup" label={t("Back up now")} busyLabel={t("Copying…")} primary />
          </div>
        </Card>

        <Card title={t("Maintenance")} note={t("Each action is written to the activity log.")}>
          <ul className="space-y-4 text-sm">
            <li className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="max-w-md">
                <div className="font-medium">{t("Remove old IP addresses")}</div>
                <p className="mt-0.5 text-sm text-ink-muted">
                  {cfg.ipRetentionDays
                    ? t(
                        "Clears visitors' IP addresses in the research log once they are older than {n} days. The network name, country and a scrambled code (hash) stay. This also happens by itself every hour; the button does it now.",
                        { n: cfg.ipRetentionDays },
                      )
                    : t("IP addresses are kept without a time limit (RESEARCH_IP_RETENTION_DAYS=0), so there is nothing to remove.")}
                </p>
              </div>
              <SystemActionButton
                action="purge-ips"
                label={t("Remove old IP addresses now")}
                busyLabel={t("Removing…")}
                disabled={cfg.ipRetentionDays === 0}
                confirmText={t("Remove every IP address recorded more than {n} days ago? This cannot be undone.", { n: cfg.ipRetentionDays })}
              />
            </li>
            <li className="flex flex-col gap-2 border-t border-hairline pt-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="max-w-md">
                <div className="font-medium">{t("Rebuild search index")}</div>
                <p className="mt-0.5 text-sm text-ink-muted">
                  {t(
                    "Reads every article into the search index again (articles_fts). Use it if search results look out of date or wrong after the database was changed directly. It takes a few seconds.",
                  )}
                </p>
              </div>
              <SystemActionButton
                action="rebuild-index"
                label={t("Rebuild search index")}
                busyLabel={t("Rebuilding…")}
                disabled={!db.fts}
                confirmText={t("Rebuild the search index now? Searches will be a little slower for a few seconds.")}
              />
            </li>
            <li className="flex flex-col gap-2 border-t border-hairline pt-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="max-w-md">
                <div className="font-medium">{t("Optimize database")}</div>
                <p className="mt-0.5 text-sm text-ink-muted">
                  {t(
                    "Refreshes the database's statistics (PRAGMA optimize), merges waiting changes into the file and, when they are under {max}, rewrites the file (VACUUM) to give back {free} of unused space. It may take a few seconds, during which saving waits.",
                    { max: bytes(VACUUM_MAX_WAL_BYTES), free: bytes(reclaimable) },
                  )}
                </p>
              </div>
              <SystemActionButton
                action="optimize"
                label={t("Optimize database")}
                busyLabel={t("Optimizing…")}
                confirmText={t("Optimize the database now? Saving pauses for a few seconds while the file is rewritten.")}
              />
            </li>
            <li className="flex flex-col gap-2 border-t border-hairline pt-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="max-w-md">
                <div className="font-medium">{t("Sign out everywhere")}</div>
                <p className="mt-0.5 text-sm text-ink-muted">
                  {t(
                    "Ends every admin login on every device, this one included. Use it after signing in on a shared computer or if a device was lost. Signing out normally only ends the login in that browser.",
                  )}
                </p>
              </div>
              <SystemActionButton
                action="revoke-sessions"
                label={t("Sign out everywhere")}
                busyLabel={t("Signing out…")}
                confirmText={t("Sign out every admin login, including this one?")}
              />
            </li>
          </ul>
        </Card>

        <Card title={t("Configuration")} note={t("Read from the settings file (.env.local). Secret values are only shown as set up or not.")}>
          <Rows
            rows={[
              [
                t("Admin login"),
                cfg.auth.problem ? (
                  <Chip key="a" tone="warn">
                    {t("Disabled: {problem}", { problem: cfg.auth.problem })}
                  </Chip>
                ) : cfg.auth.devDefaults ? (
                  <Chip key="a" tone="warn">
                    {t("Development defaults")}
                  </Chip>
                ) : (
                  <Chip key="a" tone="ok">
                    {t("Set up")}
                  </Chip>
                ),
              ],
              [t("Site address"), <Mono key="s">{cfg.siteUrl}</Mono>],
              [
                t("Database location"),
                cfg.databasePathSet ? (
                  <Mono key="d">DATABASE_PATH</Mono>
                ) : (
                  <span key="d" className="text-ink-muted">
                    {t("Default (data/hoax.db)")}
                  </span>
                ),
              ],
              [
                t("Backups kept"),
                cfg.backupKeep === 0 ? (
                  <Chip key="b" tone="warn">
                    {t("Off")}
                  </Chip>
                ) : (
                  n(cfg.backupKeep)
                ),
              ],
              [
                t("IP addresses kept for"),
                cfg.ipRetentionDays === 0 ? (
                  <Chip key="r" tone="warn">
                    {t("No time limit")}
                  </Chip>
                ) : (
                  t("{n} days", { n: cfg.ipRetentionDays })
                ),
              ],
              [
                t("External model"),
                cfg.externalModel.configured ? (
                  <span key="m">
                    <Mono>{cfg.externalModel.host}</Mono> · {n(cfg.externalModel.timeoutMs)} ms
                  </span>
                ) : (
                  <Chip key="m" tone="off">
                    {t("Not set up (the trained model answers)")}
                  </Chip>
                ),
              ],
              [
                t("Telegram alerts"),
                <Chip key="t" tone={cfg.telegram ? "ok" : "off"}>
                  {cfg.telegram ? t("Set up") : t("Not set up")}
                </Chip>,
              ],
              [
                t("E-mail alerts (SMTP)"),
                cfg.smtp.configured ? (
                  <Mono key="e">{cfg.smtp.host}</Mono>
                ) : (
                  <Chip key="e" tone="off">
                    {t("Not set up")}
                  </Chip>
                ),
              ],
              [
                t("E-mail for reports"),
                cfg.reportEmail ? (
                  <Mono key="re">{cfg.reportEmail}</Mono>
                ) : (
                  <span key="re" className="text-ink-muted">
                    —
                  </span>
                ),
              ],
            ]}
          />
        </Card>

        <Card title={t("Files")} note={t("Data files the site needs besides the database")}>
          <Rows
            rows={[
              [
                t("Screenshot reader (OCR)"),
                files.ocr.present ? (
                  <span key="o">
                    <Chip tone="ok">{t("Present")}</Chip> · {files.ocr.languages.join(", ")}
                  </span>
                ) : (
                  <Chip key="o" tone="warn">
                    {t("Missing: run {command}", { command: "npm run prepare:ocr" })}
                  </Chip>
                ),
              ],
              [t("OCR folder"), <Mono key="od">{files.ocr.dir}</Mono>],
              [
                t("Trained model"),
                files.model.present ? (
                  <span key="m">
                    <Chip tone="ok">{t("Present")}</Chip> · {bytes(files.model.bytes)}
                    {files.model.trainedAt && ` · ${t("trained {date}", { date: formatAdminDateTime(files.model.trainedAt, lang) })}`}
                    {files.model.docs !== null && ` · ${t("{n} fact-checks", { n: files.model.docs })}`}
                  </span>
                ) : (
                  <Chip key="m" tone="warn">
                    {t("No model file: train one on the Model page")}
                  </Chip>
                ),
              ],
              [t("Model file"), <Mono key="mp">{files.model.path}</Mono>],
              [
                t("IP-to-network lookup (IPtoASN)"),
                files.ipdb.file ? (
                  <span key="i">
                    <Chip tone="ok">{t("Present")}</Chip> · {files.ipdb.date ? day(files.ipdb.date, lang) : files.ipdb.file} · {bytes(files.ipdb.bytes)}
                  </span>
                ) : (
                  <Chip key="i" tone="warn">
                    {t("Missing: run {command}", { command: "npm run prepare:ipdb" })}
                  </Chip>
                ),
              ],
              [t("IPtoASN folder"), <Mono key="id">{files.ipdb.dir}</Mono>],
            ]}
          />
        </Card>
      </div>
    </div>
  );
}
