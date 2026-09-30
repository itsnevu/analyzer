import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "var(--surface)",
          raised: "var(--surface-raised)",
          sunken: "var(--surface-sunken)",
        },
        ink: {
          DEFAULT: "var(--ink)",
          muted: "var(--ink-muted)",
          faint: "var(--ink-faint)",
        },
        brand: {
          DEFAULT: "var(--brand)",
          from: "var(--brand-from)",
          to: "var(--brand-to)",
        },
        verdict: {
          valid: "var(--valid)",
          warn: "var(--warn)",
          hoax: "var(--hoax)",
        },
        hairline: "var(--hairline)",
      },
      fontFamily: {
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        neu: "0 1px 2px rgba(25,24,23,0.05)",
        "neu-sm": "0 1px 2px rgba(25,24,23,0.04)",
        "neu-lg": "0 16px 48px rgba(25,24,23,0.09)",
        "neu-inset": "none",
        "neu-inset-sm": "none",
        glow: "none",
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(120deg, var(--brand-from), var(--brand-to))",
        "radial-glow": "radial-gradient(60% 60% at 50% 0%, color-mix(in srgb, var(--brand-from) 22%, transparent), transparent 70%)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(14px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(0.9)", opacity: "0.7" },
          "100%": { transform: "scale(1.6)", opacity: "0" },
        },
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.6s cubic-bezier(0.22,1,0.36,1) both",
        shimmer: "shimmer 2.5s linear infinite",
        "pulse-ring": "pulse-ring 1.8s ease-out infinite",
        marquee: "marquee 32s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
