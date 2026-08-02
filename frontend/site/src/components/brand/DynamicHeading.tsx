"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type DynamicHeadingProps = {
  text: string;
  /** Split lines on `\n` or `|` from CMS. Last line can be accent-colored. */
  as?: "h1" | "h2" | "h3" | "h4" | "span" | "p";
  className?: string;
  accentLastLine?: boolean;
  accentClassName?: string;
  lineBreakClassName?: string;
};

/**
 * Renders CMS heading text with dynamic line breaks.
 * Use `\n` or `|` in the CMS string — no hardcoded words.
 */
export function DynamicHeading({
  text,
  as: Tag = "span",
  className,
  accentLastLine = false,
  accentClassName = "text-brand-orange",
  lineBreakClassName = "hidden sm:block",
}: DynamicHeadingProps) {
  const lines = text
    .split(/\n|\|/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (!lines.length) return null;

  if (lines.length === 1) {
    return <Tag className={className}>{lines[0]}</Tag>;
  }

  const nodes: ReactNode[] = [];
  lines.forEach((line, i) => {
    const isLast = i === lines.length - 1;
    nodes.push(
      <span key={`line-${i}`} className={accentLastLine && isLast ? accentClassName : undefined}>
        {line}
      </span>,
    );
    if (!isLast) {
      nodes.push(" ");
      nodes.push(<br key={`br-${i}`} className={lineBreakClassName} />);
    }
  });

  return <Tag className={cn(className)}>{nodes}</Tag>;
}
