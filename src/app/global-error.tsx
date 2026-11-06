"use client";

import { useSyncExternalStore } from "react";
import { makeSiteT, parseSiteLang, SITE_LANG_COOKIE, type SiteLang } from "@/lib/site-lang";

/** The language cookie, read in the browser: this screen replaces the root layout, so the language provider is not there. */
function readLang(): SiteLang {
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${SITE_LANG_COOKIE}=([^;]*)`));
  return parseSiteLang(match?.[1]);
}
const noSubscribe = () => () => {};

/** Last-resort error screen, used when the root layout itself fails; so it brings its own html and styles. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const lang = useSyncExternalStore(noSubscribe, readLang, () => "en" as SiteLang);
  const t = makeSiteT(lang);
  return (
    <html lang={lang}>
      <head>
        {/* No stylesheet is loaded here, so the two colour schemes are declared inline. */}
        <style>{`
          :root { --bg: #0e0e10; --ink: #ebe9e4; --muted: #a8a49c; --btn: #ebe9e4; --btn-ink: #0e0e10; color-scheme: dark; }
          body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: var(--bg); color: var(--ink); font-family: system-ui, sans-serif; text-align: center; padding: 24px; }
          p { color: var(--muted); line-height: 1.6; }
          button { margin-top: 16px; padding: 12px 24px; border-radius: 999px; border: 0; background: var(--btn); color: var(--btn-ink); font-size: 14px; cursor: pointer; }
        `}</style>
      </head>
      <body>
        <div style={{ maxWidth: 420 }}>
          <h1 style={{ fontSize: 28, margin: 0 }}>{t("Hoax Analyzer is having trouble")}</h1>
          <p>
            {error.digest
              ? t("The site could not load. Please try again in a moment (code {code}).", { code: error.digest })
              : t("The site could not load. Please try again in a moment.")}
          </p>
          <button onClick={reset}>{t("Try again")}</button>
        </div>
      </body>
    </html>
  );
}
