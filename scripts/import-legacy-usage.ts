/**
 * Copies the old detector's search log (data/legacy-panel/panel/search-analytic.json,
 * April 2019 – February 2024, with visitor IP addresses) into the research log
 * as origin 'legacy', naming each address's network. Timestamps were server
 * time (WIB, UTC+7). Safe to re-run.   npm run import:usage
 */

import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { hasHashSecret, networkOf } from "../src/lib/ip-asn.ts";

try {
  process.loadEnvFile(".env.local"); // AUTH_SECRET (or IP_HASH_SECRET) keys the IP hashes, as on the server
} catch {
  /* checked below */
}
if (!hasHashSecret()) {
  console.error("No AUTH_SECRET or IP_HASH_SECRET: run `npm run setup` first, so the addresses are hashed with the server's key.");
  process.exit(1);
}

const FILE = path.join(process.cwd(), "data", "legacy-panel", "panel", "search-analytic.json");
const rows = (JSON.parse(fs.readFileSync(FILE, "utf8")) as { rows: { id: string; keywords: string; input_date: string; ip: string | null }[] }).rows;
// The server creates usage_log (src/lib/db.ts); start it once (npm run dev) before importing.
const db = new DatabaseSync(process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "hoax.db"));
db.exec("PRAGMA busy_timeout = 5000");
const insert = db.prepare(
  `INSERT OR IGNORE INTO usage_log (at, origin, legacyId, kind, ip, ipHash, asn, asOrg, country, input, text, url)
   VALUES (?, 'legacy', ?, 'check', ?, ?, ?, ?, ?, ?, ?, ?)`,
);
let added = 0;
db.exec("BEGIN");
for (const r of rows) {
  const text = (r.keywords ?? "").trim();
  const link = /^https?:\/\/\S+$/i.test(text);
  const net = networkOf(r.ip || null);
  const at = new Date(`${r.input_date.replace(" ", "T")}+07:00`).toISOString();
  added += Number(insert.run(at, Number(r.id), net.ip, net.ipHash, net.asn, net.asOrg, net.country, link ? "link" : "text", text.slice(0, 20_000), link ? text : "").changes);
}
db.exec("COMMIT");
const top = db
  .prepare("SELECT asOrg, COUNT(*) AS n, COUNT(DISTINCT ipHash) AS ips FROM usage_log WHERE origin = 'legacy' GROUP BY asOrg ORDER BY n DESC LIMIT 15")
  .all() as { asOrg: string; n: number; ips: number }[];
console.log(`legacy searches: ${rows.length} read, ${added} added`);
for (const t of top) console.log(`  ${String(t.n).padStart(5)} checks, ${String(t.ips).padStart(3)} IPs  ${t.asOrg || "(unknown network)"}`);
