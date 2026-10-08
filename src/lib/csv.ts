/**
 * One CSV cell, for every export in the admin panel. Text that visitors typed
 * (search queries, checked messages, referrers, user agents) can start with a
 * formula character; Excel and Google Sheets would run "=HYPERLINK(...)" as a
 * formula when the file is opened, so such a value gets a leading apostrophe,
 * which spreadsheets show as plain text.
 */
export function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? "" : String(v);
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
