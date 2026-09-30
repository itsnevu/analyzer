import type { Verdict } from "./detect";

export const VERDICT_META: Record<
  Verdict,
  { label: string; labelEn: string; color: string; ring: string; text: string; emoji: string }
> = {
  valid: {
    label: "Credible",
    labelEn: "Credible",
    color: "var(--valid)",
    ring: "ring-verdict-valid/40",
    text: "text-verdict-valid",
    emoji: "✓",
  },
  misleading: {
    label: "Misleading",
    labelEn: "Misleading",
    color: "var(--warn)",
    ring: "ring-verdict-warn/40",
    text: "text-verdict-warn",
    emoji: "!",
  },
  hoax: {
    label: "Hoax",
    labelEn: "Hoax",
    color: "var(--hoax)",
    ring: "ring-verdict-hoax/40",
    text: "text-verdict-hoax",
    emoji: "✕",
  },
};
