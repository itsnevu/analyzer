/**
 * Downloads the IPtoASN database (public domain, https://iptoasn.com, ~9 MB)
 * and builds data/ip2asn-YYYYMMDD.db, used to name the network behind an IP
 * address in the research log. Runs before `dev` and `build`; skips when the
 * newest copy is under 30 days old (`-- --force` to refresh). Never fails the build.
 * SKIP_IPDB=1 skips it entirely (CI and image builds: the site runs without the
 * file and only leaves network names out of the research log).
 */

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { DatabaseSync } from "node:sqlite";
import { IPDB_DIR, ipToBytes } from "../src/lib/ip-asn.ts";

if (process.env.SKIP_IPDB === "1") {
  console.log("[prepare-ipdb] skipped (SKIP_IPDB=1)");
  process.exit(0);
}

const URL = process.env.IP2ASN_URL ?? "https://iptoasn.com/data/ip2asn-combined.tsv.gz";
const dir = IPDB_DIR();
fs.mkdirSync(dir, { recursive: true });
const existing = fs.readdirSync(dir).filter((f) => /^ip2asn-\d{8}\.db$/.test(f)).sort();
const newest = existing.at(-1);
if (newest && !process.argv.includes("--force") && Date.now() - fs.statSync(path.join(dir, newest)).mtimeMs < 30 * 86_400_000) process.exit(0);

try {
  const res = await fetch(URL, { signal: AbortSignal.timeout(180_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const tsv = zlib.gunzipSync(Buffer.from(await res.arrayBuffer())).toString("utf8");
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const file = path.join(dir, `ip2asn-${stamp}.db`);
  fs.rmSync(file, { force: true });
  const db = new DatabaseSync(file);
  db.exec("CREATE TABLE ranges (start BLOB PRIMARY KEY, end BLOB NOT NULL, asn INTEGER, country TEXT, org TEXT) WITHOUT ROWID");
  const insert = db.prepare("INSERT OR REPLACE INTO ranges VALUES (?, ?, ?, ?, ?)");
  let n = 0;
  db.exec("BEGIN");
  for (const line of tsv.split("\n")) {
    const [a, b, asn, country, org] = line.split("\t");
    const start = a && ipToBytes(a);
    const end = b && ipToBytes(b);
    if (!start || !end || asn === "0") continue;
    insert.run(start, end, Number(asn), country ?? "", (org ?? "").trim());
    n++;
  }
  db.exec("COMMIT");
  db.close();
  // Older copies may be open in a running server (Windows locks them); that is fine, they go next time.
  for (const f of existing) {
    if (path.join(dir, f) === file) continue;
    try {
      fs.rmSync(path.join(dir, f), { force: true });
    } catch {
      /* in use */
    }
  }
  console.log(`[prepare-ipdb] ${n.toLocaleString("en-US")} network ranges in ${path.basename(file)}`);
} catch (err) {
  console.warn(`[prepare-ipdb] could not build the network database (${String(err)}); usage is still logged, without network names.`);
}
