import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { MessageError } from "./message-error";

/**
 * Uploaded images. Next only serves files that were in public/ at build time,
 * so uploads live under data/uploads/ and are served by route handlers:
 *   data/uploads/public/   article covers, served at /uploads/<name>
 *   data/uploads/reports/  report screenshots, admin-only
 * Every image is re-encoded, which drops EXIF data such as GPS location.
 * Server-only.
 */

const ROOT = path.join(path.dirname(process.env.DATABASE_PATH ?? path.join(/* turbopackIgnore: true */ process.cwd(), "data", "hoax.db")), "uploads");
const PUBLIC_DIR = path.join(ROOT, "public");
const REPORTS_DIR = path.join(ROOT, "reports");

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ACCEPTED = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const DECODABLE = new Set(["png", "jpeg", "webp", "gif"]);
// One image decoded at a time, so a burst of large uploads cannot multiply the memory use.
sharp.concurrency(1);
const NAME = /^[a-f0-9]{32}\.webp$/;

export class UploadError extends MessageError {}

/** The first bytes of a PNG, JPEG, GIF or WebP file. */
export function hasImageSignature(b: Buffer): boolean {
  if (b.length < 12) return false;
  const png = b[0] === 0x89 && b.toString("latin1", 1, 4) === "PNG";
  const jpeg = b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  const gif = b.toString("latin1", 0, 4) === "GIF8";
  const webp = b.toString("latin1", 0, 4) === "RIFF" && b.toString("latin1", 8, 12) === "WEBP";
  return png || jpeg || gif || webp;
}

async function storeImage(file: File, dir: string, maxWidth: number): Promise<string> {
  if (!ACCEPTED.has(file.type)) throw new UploadError("Upload a PNG, JPEG, WebP or GIF image.");
  if (file.size > MAX_UPLOAD_BYTES) throw new UploadError("The image is larger than 5 MB.");
  let output: Buffer;
  try {
    const input = Buffer.from(await file.arrayBuffer());
    // The browser's label is not proof: the bytes must really be one of these formats, so an SVG, TIFF or HEIF file
    // named "x.png" never reaches those decoders. The signature is checked before any decoder sees the file.
    if (!hasImageSignature(input)) throw new UploadError("Upload a PNG, JPEG, WebP or GIF image.");
    const { format } = await sharp(input).metadata();
    if (!format || !DECODABLE.has(format)) throw new UploadError("Upload a PNG, JPEG, WebP or GIF image.");
    output = await sharp(input, { limitInputPixels: 25_000_000 })
      .rotate()
      .resize({ width: maxWidth, height: maxWidth * 2, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
  } catch (err) {
    if (err instanceof UploadError) throw err;
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
