import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

/**
 * Uploaded images. Next only serves files that were in public/ at build time,
 * so uploads live under data/uploads/ and are served by route handlers:
 *   data/uploads/public/   article covers, served at /uploads/<name>
 *   data/uploads/reports/  report screenshots, admin-only
 * Every image is re-encoded, which drops EXIF data such as GPS location.
 * Server-only.
 */

const ROOT = path.join(path.dirname(process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "hoax.db")), "uploads");
const PUBLIC_DIR = path.join(ROOT, "public");
const REPORTS_DIR = path.join(ROOT, "reports");

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ACCEPTED = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const NAME = /^[a-f0-9]{32}\.webp$/;

export class UploadError extends Error {}

async function storeImage(file: File, dir: string, maxWidth: number): Promise<string> {
  if (!ACCEPTED.has(file.type)) throw new UploadError("Upload a PNG, JPEG, WebP or GIF image.");
  if (file.size > MAX_UPLOAD_BYTES) throw new UploadError("The image is larger than 5 MB.");
  let output: Buffer;
  try {
    output = await sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 40_000_000 })
      .rotate()
      .resize({ width: maxWidth, height: maxWidth * 2, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    throw new UploadError("That file could not be read as an image.");
  }
  fs.mkdirSync(dir, { recursive: true });
  const name = `${crypto.randomBytes(16).toString("hex")}.webp`;
  fs.writeFileSync(path.join(dir, name), output);
  return name;
}

/** Saves an article cover and returns its public URL. */
export async function saveArticleImage(file: File): Promise<string> {
  return `/uploads/${await storeImage(file, PUBLIC_DIR, 1600)}`;
}

/** Saves a report screenshot and returns its file name (not publicly reachable). */
export async function saveReportImage(file: File): Promise<string> {
  return storeImage(file, REPORTS_DIR, 2000);
}

/** Absolute path of a public upload, or null for a name that is not one of ours. */
export function publicUploadPath(name: string): string | null {
  return NAME.test(name) ? path.join(PUBLIC_DIR, name) : null;
}

export function reportAttachmentPath(name: string): string {
  if (!NAME.test(name)) throw new UploadError("Unknown attachment.");
  return path.join(REPORTS_DIR, name);
}
