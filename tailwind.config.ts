import type { Config } from "tailwindcss";

/** A theme colour from its RGB-triplet token, so `bg-x/50` style alpha modifiers work. */
const token = (name: string) => `rgb(var(--${name}-rgb) / <alpha-value>)`;

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: token("surface"),
          raised: token("surface-raised"),
          sunken: token("surface-sunken"),
        },
        ink: {
          DEFAULT: token("ink"),
          muted: token("ink-muted"),
          faint: token("ink-faint"),
        },
        brand: {
          DEFAULT: token("brand"),
          from: token("brand-from"),
          to: token("brand-to"),
        },
        verdict: {
          valid: token("valid"),
          warn: token("warn"),
          hoax: token("hoax"),
        },
        hairline: "var(--hairline)",
      },
      fontFamily: {
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      // Shadow colours are theme tokens: faint on the light theme, deeper on charcoal.
      boxShadow: {
        neu: "0 1px 2px var(--shadow-1)",
        "neu-sm": "0 1px 2px var(--shadow-2)",
        "neu-lg": "0 16px 48px var(--shadow-3)",
        "neu-inset": "none",
        "neu-inset-sm": "none",
        nav: "0 14px 34px -14px var(--nav-shadow)",
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
