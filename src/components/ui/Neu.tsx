import Link from "next/link";
import { clsx } from "@/lib/clsx";

/* ---- Card ------------------------------------------------------------- */
export function Card({
  className,
  children,
  inset = false,
}: {
  className?: string;
  children: React.ReactNode;
  inset?: boolean;
}) {
  return (
    <div className={clsx(inset ? "neu-inset" : "neu", "p-6", className)}>
      {children}
    </div>
  );
}

/* ---- Eyebrow label (Verdex-style section kicker) ---------------------- */
export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <span className="eyebrow">{children}</span>;
}

/* ---- Buttons ---------------------------------------------------------- */
type BtnProps = {
  children: React.ReactNode;
  href?: string;
  className?: string;
  variant?: "primary" | "neu";
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({
  children,
  href,
  className,
  variant = "primary",
  ...rest
}: BtnProps) {
  const cls = clsx(
    variant === "primary" ? "btn-primary" : "neu-btn px-6 py-3 font-medium",
    "inline-flex items-center justify-center gap-2 text-sm",
    className,
  );
  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button className={cls} {...rest}>
      {children}
    </button>
  );
}

/* ---- Pill / Badge ----------------------------------------------------- */
export function Pill({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full border border-hairline bg-surface-raised px-3 py-1 text-xs font-medium text-ink-muted shadow-neu-inset-sm",
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ---- Section heading -------------------------------------------------- */
export function SectionHeading({
  eyebrow,
  title,
  intro,
  center = false,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  intro?: React.ReactNode;
  center?: boolean;
}) {
  return (
    <div className={clsx("max-w-2xl", center && "mx-auto text-center")}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-balance sm:text-4xl">
        {title}
      </h2>
      {intro && <p className="mt-4 text-ink-muted leading-relaxed">{intro}</p>}
    </div>
  );
}
