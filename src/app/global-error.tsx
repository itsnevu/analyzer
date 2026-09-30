"use client";

/** Last-resort error screen, used when the root layout itself fails; so it brings its own html and styles. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#faf9f6", color: "#191817", fontFamily: "system-ui, sans-serif", textAlign: "center", padding: 24 }}>
        <div style={{ maxWidth: 420 }}>
          <h1 style={{ fontSize: 28, margin: 0 }}>Hoax Analyzer is having trouble</h1>
          <p style={{ color: "#57534e", lineHeight: 1.6 }}>
            The site could not load. Please try again in a moment{error.digest ? ` (code ${error.digest})` : ""}.
          </p>
          <button
            onClick={reset}
            style={{ marginTop: 16, padding: "12px 24px", borderRadius: 999, border: 0, background: "#191817", color: "#fff", fontSize: 14, cursor: "pointer" }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
