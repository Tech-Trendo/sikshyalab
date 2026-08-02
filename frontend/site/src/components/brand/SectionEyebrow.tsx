"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type SectionEyebrowProps = {
  children: ReactNode;
  className?: string;
  align?: "left" | "center";
};

/** Orange uppercase section label — use above every section heading. */
export function SectionEyebrow({
  children,
  className,
  align = "center",
}: SectionEyebrowProps) {
  return (
    <p
      className={cn(
        "sl-section-eyebrow",
        align === "left" ? "text-left" : "text-center",
        className,
      )}
    >
      {children}
    </p>
  );
}
