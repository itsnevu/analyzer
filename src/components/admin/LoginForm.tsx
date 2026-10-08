"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "@/lib/clsx";

const field =
  "w-full rounded-lg border border-hairline bg-surface-sunken px-4 py-3 text-sm text-ink outline-none transition-shadow placeholder:text-ink-faint focus:ring-2 focus:ring-brand/30 disabled:cursor-not-allowed disabled:opacity-60";

/**
 * The sign-in form on the right of the login page. Step 1 asks for the
 * password; when the server says a two-factor code is needed, step 2 asks for
 * the 6-digit code and sends both together.
 * notice: a configuration warning from the server, shown above the form.
 */
export function LoginForm({ notice, disabled }: { notice?: string; disabled?: boolean }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  // Shown once the server says the password was right and a two-factor code is needed.
  const [needsCode, setNeedsCode] = useState(false);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (disabled) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(needsCode ? { password, code } : { password }),
      });
      const data = await res.json();
      if (data.needsCode) {
        setNeedsCode(true);
        setError(null);
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error(data.error ?? "Login failed.");
      router.push("/admin");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      // A used or wrong code is no good for a second try; the next one comes from the app.
      if (needsCode) setCode("");
      setLoading(false);
    }
  }

  function backToPassword() {
    setNeedsCode(false);
    setCode("");
    setError(null);
  }

  // Caps Lock is only knowable from a key or mouse event, so it is read on every key press in the field.
  const readCapsLock = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (typeof e.getModifierState === "function") setCapsLock(e.getModifierState("CapsLock"));
  };

  return (
    <div className="w-full max-w-sm">
      <div className="mb-6">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-faint">{needsCode ? "Step 2 of 2" : "Admin sign in"}</p>
        <h2 className="mt-2 font-display text-2xl font-bold tracking-tight">{needsCode ? "Two-factor check" : "Welcome back"}</h2>
        <p className="mt-1 text-sm text-ink-muted">
          {needsCode ? "Enter the code from your authenticator app to finish signing in." : "Sign in to manage the archive, reports and the detector."}
        </p>
      </div>

      {notice && (
        <p role="note" className="mb-4 rounded-lg border border-verdict-warn/40 bg-verdict-warn/10 px-4 py-3 text-sm leading-relaxed text-ink">
          {notice}
        </p>
      )}

      <form onSubmit={onSubmit} className="neu space-y-4 p-6" aria-busy={loading}>
        {!needsCode ? (
          <div>
            <label htmlFor="admin-password" className="mb-1.5 block text-xs font-medium text-ink-muted">
              Password
            </label>
            <div className="relative">
              <input
                id="admin-password"
                type={showPassword ? "text" : "password"}
                autoFocus
                required
                disabled={disabled}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={readCapsLock}
                onKeyUp={readCapsLock}
                onBlur={() => setCapsLock(false)}
                placeholder="••••••••"
                aria-describedby={capsLock ? "caps-warning" : undefined}
                className={clsx(field, "pr-20")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                disabled={disabled}
                aria-pressed={showPassword}
                aria-controls="admin-password"
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute inset-y-1.5 right-1.5 flex items-center gap-1 rounded-md px-2.5 text-xs font-medium text-ink-muted transition-colors hover:bg-surface-raised hover:text-ink disabled:opacity-50"
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                <span>{showPassword ? "Hide" : "Show"}</span>
              </button>
            </div>
            {capsLock && (
              <p id="caps-warning" role="status" className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-verdict-warn">
                <span aria-hidden>⇪</span> Caps Lock is on.
              </p>
            )}
          </div>
        ) : (
          <div>
            <div className="mb-3 flex items-center justify-between gap-2 rounded-lg bg-surface-sunken px-3 py-2 text-xs text-ink-muted">
              <span className="flex items-center gap-1.5">
                <span aria-hidden className="text-verdict-valid">✓</span> Password accepted
              </span>
              <button type="button" onClick={backToPassword} className="font-medium text-ink hover:text-brand">
                Change
              </button>
            </div>
            <label htmlFor="admin-code" className="mb-1.5 block text-xs font-medium text-ink-muted">
              Authenticator code
            </label>
            <input
              id="admin-code"
              type="text"
              autoFocus
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9 ]*"
              maxLength={7}
              required
              disabled={disabled}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, ""))}
              placeholder="123456"
              aria-describedby="totp-hint"
              className={clsx(field, "text-center font-mono text-lg tracking-[0.3em]")}
            />
            <span id="totp-hint" className="mt-1.5 block text-xs text-ink-faint">
              The 6-digit code from your authenticator app.
            </span>
          </div>
        )}

        <button type="submit" disabled={loading || disabled} className="btn-primary w-full py-3 disabled:opacity-50">
          {loading ? "Checking…" : needsCode ? "Verify and sign in" : "Sign in"}
        </button>

        {error && (
          <p role="alert" className="rounded-lg border border-verdict-hoax/30 bg-verdict-hoax/10 px-4 py-2.5 text-sm text-verdict-hoax">
            {error}
          </p>
        )}
      </form>

      <p className="mt-4 text-center text-xs text-ink-faint">
        Forgot the password? Set it with the <code className="rounded bg-surface-sunken px-1">ADMIN_PASSWORD</code> variable.
      </p>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 3l18 18" />
      <path d="M10.6 5.1A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.2M6.6 6.6C3.7 8.4 2 12 2 12s3.5 7 10 7c1.8 0 3.4-.5 4.8-1.3" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  );
}
