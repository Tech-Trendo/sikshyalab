"use client";

import { motion, useTransform } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { useMouseTrackContext } from "@/components/brand/useMouseTrack";
import { cn } from "@/lib/utils";

const TRACK_STRENGTH = 14;

export function HeroFloatIcon({
  src,
  alt = "",
  className,
  delay = 0,
  distance = 14,
  duration = 4.2,
  depth = 0.6,
  inFront = false,
}: {
  src: string;
  alt?: string;
  className?: string;
  delay?: number;
  distance?: number;
  duration?: number;
  depth?: number;
  inFront?: boolean;
}) {
  const { normX, normY } = useMouseTrackContext();
  const x = useTransform(normX, (v) => v * depth * TRACK_STRENGTH);
  const yTrack = useTransform(normY, (v) => v * depth * TRACK_STRENGTH);

  return (
    <motion.div
      className={cn(
        "pointer-events-none absolute",
        inFront ? "z-[6]" : "z-[2]",
        className,
      )}
      style={{ x, y: yTrack }}
      aria-hidden={!alt}
    >
      <motion.div
        animate={{ y: [0, -distance, 0] }}
        transition={{ duration, repeat: Infinity, ease: "easeInOut", delay }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className="h-auto w-full max-w-none drop-shadow-[0_10px_20px_rgba(35,31,64,0.12)]"
          draggable={false}
        />
      </motion.div>
    </motion.div>
  );
}

export function HeroDotCluster({
  className,
  color,
  size = 100,
  opacity = 0.55,
}: {
  className?: string;
  color: string;
  size?: number;
  opacity?: number;
}) {
  return (
    <div
      className={cn("pointer-events-none absolute z-[1]", className)}
      style={{
        width: size,
        height: size,
        backgroundImage: `radial-gradient(circle, ${color} 1.6px, transparent 1.7px)`,
        backgroundSize: "12px 12px",
        opacity,
      }}
      aria-hidden
    />
  );
}

export function HeroStat({
  value,
  label,
  icon: Icon,
  iconColor,
  textColor = "#231F40",
}: {
  value: string;
  label: string;
  icon: LucideIcon;
  iconColor?: string;
  textColor?: string;
}) {
  return (
    <div className="flex items-center gap-3 sm:gap-3.5">
      <div
        className="grid h-[64px] w-[64px] shrink-0 place-items-center rounded-full bg-white shadow-[0_10px_40px_rgba(0,0,0,0.08)] sm:h-[70px] sm:w-[70px]"
        style={{ color: iconColor }}
      >
        <Icon className="h-6 w-6 sm:h-7 sm:w-7" strokeWidth={1.75} aria-hidden />
      </div>
      <p
        className="text-left font-heading text-[16px] font-semibold leading-[1.35] sm:text-[17px]"
        style={{ color: textColor }}
      >
        {value}
        <br />
        {label}
      </p>
    </div>
  );
}
