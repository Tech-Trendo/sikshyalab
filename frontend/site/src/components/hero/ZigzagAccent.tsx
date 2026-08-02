"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export type ZigzagAccentProps = {
  className?: string;
  /** Stroke color */
  color?: string;
  /** SVG display width in px */
  width?: number;
  /** SVG display height in px */
  height?: number;
  /** Peaks per zigzag row */
  peaks?: number;
  /** Number of parallel zigzag rows */
  rows?: number;
  /** Stroke thickness */
  strokeWidth?: number;
  /**
   * Idle motion axis.
   * - `x` = side-to-side (hero demo)
   * - `y` = up-down bob
   */
  motion?: "x" | "y" | "none";
  /** Motion travel distance in px */
  amplitude?: number;
  /** Loop duration in seconds */
  duration?: number;
};

/**
 * Reusable zigzag / wave accent.
 * Place absolutely beside headings — does not overlap text by itself.
 */
export function ZigzagAccent({
  className,
  color = "#1AB69D",
  width = 56,
  height = 72,
  peaks = 3,
  rows = 3,
  strokeWidth = 5,
  motion: motionAxis = "x",
  amplitude = 6,
  duration = 3.5,
  /** `wave` = soft sine (Programming hero); `zigzag` = sharp peaks */
  variant = "wave",
}: ZigzagAccentProps & { variant?: "wave" | "zigzag" }) {
  const vbW = 108;
  const vbH = 84;
  const rowGap = vbH / (rows + 0.4);

  const buildRow = (baseY: number) => {
    if (variant === "wave") {
      const pts: string[] = [];
      const steps = 16;
      for (let i = 0; i <= steps; i++) {
        const x = (i / steps) * vbW;
        const y = baseY + Math.sin((i / steps) * Math.PI * 2.2) * 10;
        pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
      }
      return pts.join(" ");
    }
    const peakSpan = vbW / (peaks * 2);
    const pts: string[] = [];
    for (let i = 0; i <= peaks * 2; i++) {
      const x = i * peakSpan;
      const y = i % 2 === 0 ? baseY + 12 : baseY;
      pts.push(`${x},${y}`);
    }
    return pts.join(" ");
  };

  const animate =
    motionAxis === "none"
      ? undefined
      : motionAxis === "x"
        ? { x: [-amplitude, amplitude, -amplitude] }
        : { y: [-amplitude, amplitude, -amplitude] };

  return (
    <motion.div
      className={cn("pointer-events-none", className)}
      animate={animate}
      transition={
        motionAxis === "none"
          ? undefined
          : { duration, repeat: Infinity, ease: "easeInOut" }
      }
      aria-hidden
    >
      <svg width={width} height={height} viewBox={`0 0 ${vbW} ${vbH}`} fill="none">
        {Array.from({ length: rows }).map((_, i) => (
          <polyline
            key={i}
            points={buildRow(4 + i * rowGap)}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        ))}
      </svg>
    </motion.div>
  );
}
