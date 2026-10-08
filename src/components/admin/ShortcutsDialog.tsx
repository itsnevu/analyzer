"use client";

import { useEffect, useRef } from "react";
import { SHORTCUT_GROUPS } from "@/lib/shortcuts";
import { useAdminT } from "./AdminLang";

/** The "?" dialog: every keyboard shortcut of the panel, grouped by where it works. */
export function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const { t } = useAdminT();

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-[10vh] backdrop-blur-sm" onMouseDown={onClose} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-hairline bg-surface-raised shadow-neu-lg"
      >
        <div className="flex items-center gap-3 border-b border-hairline px-5 py-3">
          <h2 id="shortcuts-title" className="flex-1 font-display text-lg font-bold">
            {t("Keyboard shortcuts")}
          </h2>
          <button ref={closeRef} type="button" onClick={onClose} className="neu-btn px-3 py-1 text-xs" aria-label={t("Close")}>
            Esc ×
          </button>
        </div>
        <div className="grid gap-x-8 gap-y-5 p-5 sm:grid-cols-2">
          {SHORTCUT_GROUPS.map((group) => (
            <section key={group.title}>
              <h3 className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-faint">{t(group.title)}</h3>
              <ul className="space-y-1.5">
                {group.items.map((item) => (
                  <li key={item.label} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-ink-muted">{t(item.label)}</span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      {item.keys.map((combo, i) => (
                        <span key={combo.join("+")} className="flex items-center gap-1">
                          {i > 0 && <span className="text-[10px] text-ink-faint">{t("or")}</span>}
                          {combo.map((k, j) => (
                            <span key={`${k}-${j}`} className="flex items-center gap-1">
                              {j > 0 && combo[0] === "g" && <span className="text-[10px] text-ink-faint">{t("then")}</span>}
                              <kbd className="min-w-[1.5rem] rounded-md border border-hairline bg-surface-sunken px-1.5 py-0.5 text-center font-mono text-[11px] text-ink">{k}</kbd>
                            </span>
                          ))}
                        </span>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <p className="border-t border-hairline px-5 py-3 text-xs text-ink-faint">
          {t("Shortcuts are off while you type in a field. After “g”, press the second key within one second.")}
        </p>
      </div>
    </div>
  );
}
