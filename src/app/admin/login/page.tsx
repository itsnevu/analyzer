"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogoMark } from "@/components/ui/Logo";

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Login failed.");
      router.push("/admin");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-[80vh] place-items-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <LogoMark className="h-12 w-12" />
          <h1 className="mt-4 font-display text-2xl font-bold">Admin Panel</h1>
          <p className="mt-1 text-sm text-ink-muted">Sign in to manage content.</p>
        </div>

        <form onSubmit={onSubmit} className="neu space-y-4 p-6">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-ink-muted">Password</span>
            <input
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-lg border border-hairline bg-surface-sunken px-4 py-3 text-sm text-ink outline-none focus:ring-2 focus:ring-brand/30"
            />
          </label>

          <button type="submit" disabled={loading} className="btn-primary w-full py-3">
            {loading ? "Checking…" : "Sign in"}
          </button>

          {error && (
            <p className="rounded-lg border border-verdict-hoax/30 bg-verdict-hoax/10 px-4 py-2.5 text-sm text-verdict-hoax">
              {error}
            </p>
          )}
        </form>

        <p className="mt-4 text-center text-xs text-ink-faint">
          Forgot the password? Set it with the <code className="rounded bg-surface-sunken px-1">ADMIN_PASSWORD</code> variable.
        </p>
      </div>
    </div>
  );
}
