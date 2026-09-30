"use client";

import { useState, useSyncExternalStore } from "react";
import { forgetBrowser } from "@/lib/usage-client";

const read = () => {
  try {
    return localStorage.getItem("hoax-analyzer:visitor") ?? "";
  } catch {
    return "";
  }
};

/** Shows this browser's research ID and lets the visitor drop it. */
export function ForgetBrowser() {
  const stored = useSyncExternalStore(() => () => {}, read, () => "");
  const [cleared, setCleared] = useState(false);
  const id = cleared ? "" : stored;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl bg-surface-sunken p-3 text-xs">
      <span>
        Browser ID: <code className="font-mono">{id || "none"}</code>
      </span>
      {id && (
        <button
          type="button"
          onClick={() => {
            forgetBrowser();
            setCleared(true);
          }}
          className="neu-btn px-3 py-1.5"
        >
          Forget this browser
        </button>
      )}
    </div>
  );
}
