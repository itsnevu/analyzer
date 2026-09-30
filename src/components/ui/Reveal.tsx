"use client";

import { useEffect, useRef, useState } from "react";
import { clsx } from "@/lib/clsx";

/**
 * Reveal-on-scroll wrapper. Fades + lifts children into view once, when they
 * enter the viewport. With prefers-reduced-motion the content is simply shown (CSS only).
 */
export function Reveal({
  children,
  delay = 0,
  className,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  as?: React.ElementType;
}) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      style={{ transitionDelay: shown ? `${delay}ms` : "0ms" }}
      className={clsx(
        "transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform motion-reduce:transition-none",
        shown ? "opacity-100 translate-y-0 blur-0" : "opacity-0 translate-y-6 blur-[2px] motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:blur-0",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
