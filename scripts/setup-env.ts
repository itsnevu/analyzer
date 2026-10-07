/**
 * Creates or completes .env.local with a strong admin password and session
 * secret. Existing values that are already strong are left alone.
 *
 *   npm run setup                       generate what is missing
 *   npm run setup -- --password "..."   use this admin password instead of a random one
 *   npm run setup -- --totp             turn on two-factor login: new ADMIN_TOTP_SECRET,
 *                                       printed with its otpauth:// URL and a QR code to scan
 *   npm run setup -- --no-totp          turn two-factor login off again
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { encodeQr, qrToText } from "../src/lib/qr.ts";
import { generateTotpSecret, otpauthUrl } from "../src/lib/totp.ts";

const FILE = path.join(process.cwd(), ".env.local");
const args = process.argv.slice(2);
const chosen = args.includes("--password") ? args[args.indexOf("--password") + 1] : undefined;
const totpOn = args.includes("--totp");
const totpOff = args.includes("--no-totp");
if (totpOn && totpOff) {
  console.error("Use either --totp or --no-totp, not both.");
  process.exit(1);
}

function randomPassword(): string {
  // No look-alike characters, so it can be read off a screen.
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(crypto.randomBytes(18), (b) => alphabet[b % alphabet.length]).join("");
}

const lines = fs.existsSync(FILE) ? fs.readFileSync(FILE, "utf8").split(/\r?\n/) : [];
// Trailing blank lines are dropped here and the file always ends with one newline.
while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();
const get = (key: string) => lines.find((l) => l.startsWith(`${key}=`))?.slice(key.length + 1).trim() ?? "";
const set = (key: string, value: string) => {
  const i = lines.findIndex((l) => l.startsWith(`${key}=`));
  if (i >= 0) lines[i] = `${key}=${value}`;
  else lines.push(`${key}=${value}`);
};
const remove = (key: string) => {
  const i = lines.findIndex((l) => l.startsWith(`${key}=`));
  if (i < 0) return false;
  // Take the comment line written with it, and the blank line before that, too.
  let start = i;
  if (start > 0 && lines[start - 1].startsWith("# Two-factor login")) start--;
  if (start > 0 && lines[start - 1].trim() === "") start--;
  lines.splice(start, i - start + 1);
  return true;
};

const changes: string[] = [];

const currentPassword = get("ADMIN_PASSWORD");
if (chosen !== undefined) {
  if (chosen.length < 10) {
    console.error("The admin password must be at least 10 characters.");
    process.exit(1);
  }
  set("ADMIN_PASSWORD", chosen);
  changes.push("ADMIN_PASSWORD set to the password you gave");
} else if (currentPassword.length < 10 || currentPassword === "admin123") {
  const generated = randomPassword();
  set("ADMIN_PASSWORD", generated);
  changes.push(`ADMIN_PASSWORD generated: ${generated}   <- write this down, it is not shown again`);
}

const currentSecret = get("AUTH_SECRET");
if (currentSecret.length < 32 || /change-me|dev-insecure/.test(currentSecret)) {
  set("AUTH_SECRET", crypto.randomBytes(32).toString("hex"));
  changes.push("AUTH_SECRET generated");
}

if (!lines.some((l) => l.startsWith("SITE_URL="))) {
  lines.push("", "# Public address of the site (for the sitemap and share previews)", "SITE_URL=https://syyhoaxanalyzer.com");
  changes.push("SITE_URL added (edit it if the site runs on another address)");
}

// Printed after the file is written, so the secret is only shown once it is saved.
let totpSecret: string | null = null;
if (totpOn) {
  totpSecret = generateTotpSecret();
  if (!lines.some((l) => l.startsWith("ADMIN_TOTP_SECRET="))) {
    lines.push("", "# Two-factor login: base32 secret shared with the admin's authenticator app (npm run setup -- --totp)");
  }
  const replaced = Boolean(get("ADMIN_TOTP_SECRET"));
  set("ADMIN_TOTP_SECRET", totpSecret);
  changes.push(replaced ? "ADMIN_TOTP_SECRET replaced with a new secret (codes from the old one stop working)" : "ADMIN_TOTP_SECRET generated: two-factor login is on");
} else if (totpOff && remove("ADMIN_TOTP_SECRET")) {
  changes.push("ADMIN_TOTP_SECRET removed: two-factor login is off");
}

if (!changes.length) {
  console.log(".env.local already has a strong ADMIN_PASSWORD and AUTH_SECRET. Nothing changed.");
  if (totpOff) console.log("Two-factor login was already off (no ADMIN_TOTP_SECRET).");
} else {
  fs.writeFileSync(FILE, lines.join("\n").replace(/^\n+/, "") + "\n", { mode: 0o600 });
  console.log(`Updated ${FILE}:`);
  for (const c of changes) console.log(`  - ${c}`);
  console.log("Restart the server for the new values to take effect. Changing ADMIN_PASSWORD or AUTH_SECRET signs the admin out.");
}

if (totpSecret) {
  const url = otpauthUrl(totpSecret, "Hoax Analyzer", "admin");
  console.log("");
  console.log("Add this account to an authenticator app (Google Authenticator, Aegis, 1Password, ...):");
  console.log(`  Secret (enter by hand): ${totpSecret.replace(/(.{4})(?=.)/g, "$1 ")}`);
  console.log(`  otpauth URL:            ${url}`);
  try {
    console.log("");
    console.log("Or scan this QR code:");
    console.log(qrToText(encodeQr(url)));
  } catch {
    /* too long for the terminal QR code; the secret and URL above are enough */
  }
  console.log("");
  console.log("After the restart, the login page asks for the 6-digit code after the password.");
  console.log("Keep the secret somewhere safe: without it (or the phone) you can only get in by running `npm run setup -- --no-totp` on the server.");
}
