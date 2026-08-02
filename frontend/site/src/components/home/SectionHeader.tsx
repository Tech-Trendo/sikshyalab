"use client";

import { SectionHeader as BrandSectionHeader } from "@/components/brand/Section";

type Props = {
  eyebrow?: string;
  /** Preferred */
  heading?: string;
  /** Alias */
  title?: string;
  subtitle?: string;
  align?: "left" | "center";
  className?: string;
};

/** Thin wrapper — use `eyebrow` + `heading` everywhere. */
export function SectionHeader({
  eyebrow,
  heading,
  title,
  subtitle,
  align = "center",
  className = "",
}: Props) {
  return (
    <BrandSectionHeader
      eyebrow={eyebrow}
      heading={heading ?? title}
      description={subtitle}
      align={align}
      className={`sl-section-head ${className}`.trim()}
    />
  );
}
