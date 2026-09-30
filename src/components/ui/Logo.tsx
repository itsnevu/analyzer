import { clsx } from "@/lib/clsx";

const TILES = [
  { x: 1, y: 1, c: "#3b9199", l: "H" }, // teal
  { x: 51, y: 1, c: "#d1348c", l: "O" }, // magenta
  { x: 1, y: 51, c: "#e2903f", l: "A" }, // orange
  { x: 51, y: 51, c: "#6d85a6", l: "X" }, // slate-blue
];

/** The original SYY Hoax Analyzer mark: a 2×2 grid spelling H-O-A-X. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 98 98" className={className} role="img" aria-label="Hoax Analyzer">
      {TILES.map((t) => (
        <g key={t.l}>
          <rect x={t.x} y={t.y} width="46" height="46" rx="9" fill={t.c} />
          <text
            x={t.x + 23}
            y={t.y + 25}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#ffffff"
            fontSize="27"
            fontWeight="800"
            fontFamily="var(--font-sora), system-ui, sans-serif"
          >
            {t.l}
          </text>
        </g>
      ))}
    </svg>
  );
}

export function Logo({
  className,
  wordmark = true,
}: {
  className?: string;
  wordmark?: boolean;
}) {
  return (
    <span className={clsx("flex items-center gap-2.5", className)}>
      <LogoMark className="h-9 w-9 shrink-0" />
      {wordmark && (
        <span className="leading-none">
          <span className="block font-mono text-[10px] font-semibold uppercase tracking-[0.25em] text-ink-faint">
            SYY
          </span>
          <span className="block font-display text-sm font-bold leading-tight tracking-tight text-ink">
            Hoax Analyzer
          </span>
        </span>
      )}
    </span>
  );
}
