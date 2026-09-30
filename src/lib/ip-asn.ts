import { createHash, createHmac } from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

/**
 * Network (AS number, owner, country) of an IP address, from the IPtoASN
 * database (public domain, iptoasn.com) that `npm run prepare:ipdb` saves as
 * data/ip2asn-YYYYMMDD.db. Looked up locally: addresses are never sent anywhere.
 * Returns null when the database is missing. Server-only.
 */

export const IPDB_DIR = () => process.env.IP2ASN_DIR ?? path.join(/* turbopackIgnore: true */ process.cwd(), "data");
const RECHECK_MS = 60 * 60 * 1000;

const state = globalThis as unknown as { __ipdb?: { db: DatabaseSync | null; file: string; checked: number } };

/** 16 bytes; IPv4 is mapped into ::ffff:0:0/96 so both families share one ordering. */
export function ipToBytes(ip: string): Buffer | null {
  const addr = ip.trim().replace(/%.*$/, "");
  const kind = net.isIP(addr);
  if (kind === 4) return Buffer.from([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xff, 0xff, ...addr.split(".").map(Number)]);
  if (kind !== 6) return null;
  // "::ffff:1.2.3.4" → "::ffff:102:304"
  const hex = addr.replace(/(\d+)\.(\d+)\.(\d+)\.(\d+)$/, (_, a, b, c, d) =>
    `${((+a << 8) | +b).toString(16)}:${((+c << 8) | +d).toString(16)}`);
  const [l, r] = hex.split("::");
  const parse = (s: string | undefined) => (s ? s.split(":").map((h) => parseInt(h, 16)) : []);
  const left = parse(l);
  const right = parse(r);
  const words = r !== undefined ? [...left, ...Array(8 - left.length - right.length).fill(0), ...right] : left;
  if (words.length !== 8) return null;
  const out = Buffer.alloc(16);
  words.forEach((w, i) => out.writeUInt16BE(w, i * 2));
  return out;
}

function newestFile(): string {
  try {
    const files = fs.readdirSync(IPDB_DIR()).filter((f) => /^ip2asn-\d{8}\.db$/.test(f)).sort();
    return files.length ? path.join(IPDB_DIR(), files[files.length - 1]) : "";
  } catch {
    return "";
  }
}

function open(): DatabaseSync | null {
  const now = Date.now();
  const s = state.__ipdb;
  if (s && now - s.checked < RECHECK_MS) return s.db;
  const file = newestFile();
  if (s && s.file === file) {
    s.checked = now;
    return s.db;
  }
  s?.db?.close();
  let db: DatabaseSync | null = null;
  try {
    if (file) db = new DatabaseSync(file, { readOnly: true });
  } catch {
    db = null;
  }
  state.__ipdb = { db, file, checked: now };
  return db;
}

export interface Network {
  asn: number;
  org: string;
  country: string;
}

export function lookupNetwork(ip: string | null): Network | null {
  const key = ip ? ipToBytes(ip) : null;
  const db = key && open();
  if (!key || !db) return null;
  const row = db.prepare("SELECT end, asn, country, org FROM ranges WHERE start <= ? ORDER BY start DESC LIMIT 1").get(key) as
    | { end: Uint8Array; asn: number; country: string; org: string }
    | undefined;
  if (!row || Buffer.compare(Buffer.from(row.end), key) < 0 || !row.asn) return null;
  return { asn: row.asn, org: row.org, country: row.country };
}

/** Keyed hash of an address (AUTH_SECRET), kept after the address itself is cleared. */
export function ipHash(ip: string): string {
  const key = createHash("sha256").update(`usage-ip:${process.env.AUTH_SECRET ?? "dev"}`).digest();
  return createHmac("sha256", key).update(ip).digest("hex").slice(0, 16);
}

/** The research log's network columns for an address. */
export function networkOf(ip: string | null) {
  const net = lookupNetwork(ip);
  return { ip, ipHash: ip ? ipHash(ip) : "", asn: net?.asn ?? null, asOrg: net?.org ?? "", country: net?.country ?? "" };
}
