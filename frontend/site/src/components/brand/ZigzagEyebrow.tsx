"use client";

import { ZigzagAccent } from "@/components/hero/ZigzagAccent";

type Props = {
  className?: string;
  size?: "sm" | "md";
};

/** @deprecated Prefer ZigzagAccent — kept for existing FAQ / section imports */
export function ZigzagEyebrow({ className, size = "sm" }: Props) {
  const dims = size === "md" ? { width: 90, height: 80 } : { width: 72, height: 64 };
  return (
    <ZigzagAccent
      className={className}
      color="#1B3A6B"
      width={dims.width}
      height={dims.height}
      motion="y"
      amplitude={10}
      duration={4}
    />
  );
}
