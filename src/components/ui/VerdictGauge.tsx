import { clsx } from "@/lib/clsx";

/**
 * A semicircle meter for a 0..1 value (the hoax probability). Exposed to
 * assistive technology as role="meter" with its numeric value and a spoken
 * label; the arc fills once on first paint, unless reduced motion is asked
 * for (see .gauge-arc in globals.css). Has no hooks, so it renders on the
 * server and the client alike.
 */
export function VerdictGauge({
  value,
  color,
  label = "Hoax probability",
  caption = "hoax",
  size = "md",
  className,
}: {
  value: number;
  /** A CSS colour, normally a verdict token such as var(--hoax). */
  color: string;
  label?: string;
  caption?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)));
  const width = size === "lg" ? "w-56" : size === "sm" ? "w-32" : "w-44";
  const figure = size === "lg" ? "text-5xl" : size === "sm" ? "text-2xl" : "text-4xl";
  // Three faint zones under the arc: low, uncertain, high.
  const zones: [number, number, string][] = [
    [0, 40, "var(--valid)"],
    [40, 60, "var(--warn)"],
    [60, 100, "var(--hoax)"],
  ];
  const arc = "M 12 64 A 52 52 0 0 1 116 64";

  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-valuetext={`${pct}% ${label.toLowerCase()}`}
      className={clsx("relative shrink-0", width, className)}
    >
      <svg viewBox="0 0 128 72" className="block h-auto w-full overflow-visible" aria-hidden>
        <path d={arc} pathLength={100} fill="none" stroke="var(--surface-sunken)" strokeWidth="12" strokeLinecap="round" />
        {zones.map(([from, to, c]) => (
          <path
            key={from}
            d={arc}
            pathLength={100}
            fill="none"
            stroke={c}
            strokeOpacity="0.18"
            strokeWidth="12"
            strokeDasharray={`${to - from - 0.6} 100`}
            strokeDashoffset={-from - 0.3}
          />
        ))}
        <path
          d={arc}
          pathLength={100}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray="100 100"
          strokeDashoffset={100 - Math.max(pct, 1)}
          className="gauge-arc"
        />
      </svg>
      <div className="absolute inset-x-0 bottom-0 text-center leading-none">
        <div className={clsx("font-display font-bold tabular-nums tracking-tight", figure)} style={{ color: "var(--brand)" }}>
          {pct}
          <span className="text-[0.55em]">%</span>
        </div>
        <div className="meta-label mt-1.5">{caption}</div>
      </div>
    </div>
  );
}
