/**
 * Creates or completes .env.local with a strong admin password and session
 * secret. Existing values that are already strong are left alone.
 *
 *   npm run setup                       generate what is missing
 *   npm run setup -- --password "..."   use this admin password instead of a random one
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const FILE = path.join(process.cwd(), ".env.local");
const args = process.argv.slice(2);
const chosen = args.includes("--password") ? args[args.indexOf("--password") + 1] : undefined;

function randomPassword(): string {
  // No look-alike characters, so it can be read off a screen.
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(crypto.randomBytes(18), (b) => alphabet[b % alphabet.length]).join("");
}

const lines = fs.existsSync(FILE) ? fs.readFileSync(FILE, "utf8").split(/\r?\n/) : [];
const get = (key: string) => lines.find((l) => l.startsWith(`${key}=`))?.slice(key.length + 1).trim() ?? "";
const set = (key: string, value: string) => {
  const i = lines.findIndex((l) => l.startsWith(`${key}=`));
  if (i >= 0) lines[i] = `${key}=${value}`;
  else lines.push(`${key}=${value}`);
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

if (!changes.length) {
  console.log(".env.local already has a strong ADMIN_PASSWORD and AUTH_SECRET. Nothing changed.");
} else {
  fs.writeFileSync(FILE, lines.join("\n").replace(/^\n+/, "") + "\n", { mode: 0o600 });
  console.log(`Updated ${FILE}:`);
  for (const c of changes) console.log(`  - ${c}`);
  console.log("Restart the server for the new values to take effect. Changing either value signs the admin out.");
}
