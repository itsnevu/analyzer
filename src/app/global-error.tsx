"use client";

/** Last-resort error screen, used when the root layout itself fails; so it brings its own html and styles. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <head>
        {/* No stylesheet is loaded here, so the two colour schemes are declared inline. */}
        <style>{`
          :root { --bg: #faf9f6; --ink: #191817; --muted: #57534e; --btn: #191817; --btn-ink: #ffffff; color-scheme: light dark; }
          @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg: #171716; --ink: #f3f1ea; --muted: #b4afa6; --btn: #f3f1ea; --btn-ink: #171716; } }
          :root[data-theme="dark"] { --bg: #171716; --ink: #f3f1ea; --muted: #b4afa6; --btn: #f3f1ea; --btn-ink: #171716; }
          body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: var(--bg); color: var(--ink); font-family: system-ui, sans-serif; text-align: center; padding: 24px; }
          p { color: var(--muted); line-height: 1.6; }
          button { margin-top: 16px; padding: 12px 24px; border-radius: 999px; border: 0; background: var(--btn); color: var(--btn-ink); font-size: 14px; cursor: pointer; }
        `}</style>
      </head>
      <body>
        <div style={{ maxWidth: 420 }}>
          <h1 style={{ fontSize: 28, margin: 0 }}>Hoax Analyzer is having trouble</h1>
          <p>The site could not load. Please try again in a moment{error.digest ? ` (code ${error.digest})` : ""}.</p>
          <button onClick={reset}>Try again</button>
        </div>
      </body>
    </html>
  );
}
