"use client";

import { useEffect, useRef, type ReactNode } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from "framer-motion";
import { cn } from "@/lib/utils";

function useCursorTrack(strength = 10) {
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const x = useSpring(rawX, { stiffness: 55, damping: 18, mass: 0.4 });
  const y = useSpring(rawY, { stiffness: 55, damping: 18, mass: 0.4 });
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const el = rootRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const nx = Math.max(-1, Math.min(1, (e.clientX - cx) / Math.max(r.width, 1)));
      const ny = Math.max(-1, Math.min(1, (e.clientY - cy) / Math.max(r.height, 1)));
      rawX.set(nx * strength);
      rawY.set(ny * strength);
    };
    const reset = () => {
      rawX.set(0);
      rawY.set(0);
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    document.addEventListener("mouseleave", reset);
    return () => {
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseleave", reset);
    };
  }, [rawX, rawY, strength]);

  return { rootRef, track: { x, y } };
}

type RingDotDecorProps = {
  children?: ReactNode;
  className?: string;
  /** Dot grid density (px). Default 12. */
  dotSpacing?: number;
  /** How far the cluster peeks outside the corner (px). Default 48 ≈ half overlap. */
  dotOffset?: number;
  corner?: "left" | "right";
};

/**
 * Teal dots (behind card) + coral dashed ring (on corner).
 * Both are positioned for ~50% partial overlap with the card and each other.
 *
 * @example
 * <RingDotDecor dotSpacing={12} dotOffset={48}>{photo}</RingDotDecor>
 */
export default function RingDotDecor({
  children,
  className,
  dotSpacing = 12,
  dotOffset = 48,
  corner = "left",
}: RingDotDecorProps) {
  const { rootRef, track } = useCursorTrack(10);
  const dotsX = useTransform(track.x, (v) => v * 1.1);
  const dotsY = useTransform(track.y, (v) => v * 1.1);
  const ringX = useTransform(track.x, (v) => v * 0.6);
  const ringY = useTransform(track.y, (v) => v * 0.6);

  const isRight = corner === "right";
  const dotsSize = Math.round(dotSpacing * 12); // 12 → 144
  const ringSize = Math.round(dotSpacing * 8.5); // 12 → 102
  // Pull slightly into the card so ~half sits under / on the corner
  const peek = dotOffset;
  const down = Math.round(peek * 0.2);

  const dots = (
    <motion.div
      className="pointer-events-none absolute z-[1] hidden sm:block"
      style={{
        x: dotsX,
        y: dotsY,
        width: dotsSize,
        height: dotsSize,
        top: -(dotsSize / 2) + down,
        ...(isRight
          ? { right: -(dotsSize / 2) + peek * 0.15 }
          : { left: -(dotsSize / 2) + peek * 0.15 }),
      }}
      aria-hidden
    >
      <motion.img
        src="/images/theme/shape-13.png"
        alt=""
        className="h-full w-full object-contain"
        draggable={false}
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
      />
    </motion.div>
  );

  const ring = (
    <motion.div
      className={cn(
        "pointer-events-none absolute z-[5] hidden -translate-y-1/2 sm:block",
        isRight ? "translate-x-1/2" : "-translate-x-1/2",
      )}
      style={{
        x: ringX,
        y: ringY,
        width: ringSize,
        height: ringSize,
        top: down,
        ...(isRight ? { right: 0 } : { left: 0 }),
      }}
      aria-hidden
    >
      <motion.svg
        viewBox="0 0 100 100"
        className="h-full w-full overflow-visible"
        animate={{ rotate: 360 }}
        transition={{ duration: 28, repeat: Infinity, ease: "linear" }}
      >
        <circle
          cx="48"
          cy="48"
          r="38"
          stroke="#C5CAD3"
          strokeWidth="5.5"
          strokeDasharray="16 9"
          fill="none"
          strokeLinecap="round"
          opacity="0.7"
        />
        <circle
          cx="50"
          cy="50"
          r="38"
          stroke="#EE4A62"
          strokeWidth="5.5"
          strokeDasharray="16 9"
          fill="none"
          strokeLinecap="round"
        />
      </motion.svg>
    </motion.div>
  );

  if (!children) {
    return (
      <div
        ref={rootRef}
        className={cn("pointer-events-none relative isolate", className)}
        style={{ width: dotsSize, height: dotsSize }}
      >
        {dots}
        {ring}
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className={cn("relative isolate overflow-visible", className)}
    >
      {/* Stack: dots under ring; both behind the card */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-visible" aria-hidden>
        {dots}
        {ring}
      </div>
      <div className="relative z-10">{children}</div>
    </div>
  );
}
