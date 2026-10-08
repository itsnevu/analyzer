"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { clsx } from "@/lib/clsx";

export type ToastTone = "success" | "error" | "info";

export interface ToastInput {
  text: string;
  tone?: ToastTone;
}

interface ToastItem {
  id: number;
  text: string;
  tone: ToastTone;
}

type ToastFn = (input: ToastInput) => void;

// Outside a provider the call does nothing, so a component never breaks for want of one.
const ToastContext = createContext<ToastFn>(() => {});

/** `const toast = useToast(); toast({ text: "Saved", tone: "success" })`. */
export function useToast(): ToastFn {
  return useContext(ToastContext);
}

const DURATION: Record<ToastTone, number> = { success: 3500, info: 4000, error: 7000 };
const MAX_VISIBLE = 4;

/**
 * Small notices in the bottom-right corner that go away by themselves.
 * Mounted once by the admin shell; the region is a polite live region, so
 * screen readers announce each message.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setItems((list) => list.filter((t) => t.id !== id)), []);

  const toast = useCallback<ToastFn>(
    ({ text, tone = "info" }) => {
      const id = nextId.current++;
      setItems((list) => [...list, { id, text, tone }].slice(-MAX_VISIBLE));
      window.setTimeout(() => dismiss(id), DURATION[tone]);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col items-end gap-2 sm:inset-x-auto sm:right-5 sm:w-96"
      >
        {items.map((t) => (
          <div
            key={t.id}
            className={clsx(
              "pointer-events-auto flex w-full items-start gap-3 rounded-xl border bg-surface-raised px-4 py-3 text-sm text-ink shadow-neu-lg animate-fade-up",
              t.tone === "success" ? "border-verdict-valid/40" : t.tone === "error" ? "border-verdict-hoax/40" : "border-hairline",
            )}
          >
            <span
              aria-hidden
              className={clsx(
                "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold",
                t.tone === "success" ? "bg-verdict-valid/15 text-verdict-valid" : t.tone === "error" ? "bg-verdict-hoax/15 text-verdict-hoax" : "bg-surface-sunken text-ink-muted",
              )}
            >
              {t.tone === "success" ? "✓" : t.tone === "error" ? "!" : "i"}
            </span>
            <span className="min-w-0 flex-1 break-words">{t.text}</span>
            <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss" className="-mr-1 shrink-0 rounded px-1 text-ink-faint hover:text-ink">
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
