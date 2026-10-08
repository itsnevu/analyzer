import type { AdminT } from "./admin-lang";

/**
 * An error whose message is a fixed English sentence with {placeholders}, so
 * the admin API can show it in the panel's language (src/lib/admin-i18n/api.ts
 * holds the Indonesian, keyed by `key`). `message` is the filled-in English,
 * which is what the public API and the logs keep showing.
 */

export type MessageVars = Record<string, string | number>;

function fill(text: string, vars?: MessageVars): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => {
    if (!(name in vars)) return whole;
    const v = vars[name];
    return typeof v === "number" ? v.toLocaleString("en-US") : v;
  });
}

export class MessageError extends Error {
  readonly key: string;
  readonly vars: MessageVars | undefined;

  constructor(key: string, vars?: MessageVars) {
    super(fill(key, vars));
    this.key = key;
    this.vars = vars;
  }
}

/** An error's message in the admin's language: keyed errors by their key, others by their English text. */
export function translateError(err: Error, t: AdminT): string {
  return err instanceof MessageError ? t(err.key, err.vars) : t(err.message);
}
