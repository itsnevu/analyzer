import { clsx } from "@/lib/clsx";
import { SectionHeading } from "./Neu";

/**
 * One public-page section with the site's standard rhythm: page gutter, the
 * same vertical spacing everywhere, and an optional heading with an action
 * (such as a "View all" link) aligned to its right. Server-safe.
 */
export function Section({
  id,
  eyebrow,
  title,
  intro,
  action,
  center = false,
  tight = false,
  className,
  children,
}: {
  id?: string;
  eyebrow?: string;
  title?: React.ReactNode;
  intro?: React.ReactNode;
  action?: React.ReactNode;
  center?: boolean;
  /** Half the vertical padding, for strips such as the sources marquee. */
  tight?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={clsx("container-page scroll-mt-28", tight ? "py-6 sm:py-8" : "py-12 sm:py-16", className)}>
      {title && (
        <div className={clsx("mb-8 sm:mb-10", Boolean(action) && "flex flex-wrap items-end justify-between gap-6")}>
          <SectionHeading eyebrow={eyebrow} title={title} intro={intro} center={center} />
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
