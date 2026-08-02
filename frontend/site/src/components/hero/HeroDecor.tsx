"use client";

import { motion } from "framer-motion";
import {
  heroAnim,
  heroFadeIn,
} from "@/components/brand/hero-animations";
import { HERO_IMAGES } from "@/components/brand/hero-images";
import { cn } from "@/lib/utils";

type HeroWaveBandProps = {
  src: string;
  className?: string;
};

/** Bottom wave strip behind the hero. */
export function HeroWaveBand({ src, className }: HeroWaveBandProps) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-0 bottom-0 z-0 h-[150px] sm:h-[190px] lg:h-[230px]",
        className,
      )}
      style={{
        backgroundImage: `url('${src}')`,
        backgroundPosition: "bottom center",
        backgroundRepeat: "no-repeat",
        backgroundSize: "100% auto",
      }}
      aria-hidden
    />
  );
}

type HeroZigzagProps = {
  src?: string;
  className?: string;
};

/** Soft zigzag shape beside the second title line. */
export function HeroZigzag({
  src = HERO_IMAGES.shape15,
  className,
}: HeroZigzagProps) {
  return (
    <motion.img
      src={src}
      alt=""
      width={101}
      height={39}
      className={cn(
        "pointer-events-none absolute left-0 top-[40px] z-[1] hidden h-[28px] w-[72px] max-w-[72px] select-none sm:block sm:top-[52px] sm:h-[36px] sm:w-[94px] sm:max-w-[94px] lg:top-[58px] lg:h-[39px] lg:w-[101px] lg:max-w-[101px]",
        className,
      )}
      draggable={false}
      animate={{ x: [-3, 3, -3] }}
      transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
      aria-hidden
    />
  );
}

type HeroSoftRingProps = {
  color?: string;
  className?: string;
  /** Delay in ms for entrance fade. */
  delayMs?: number;
};

/** Soft coral ring that overlaps the start of the title. */
export function HeroSoftRing({
  color = "rgba(238,74,98,0.22)",
  className,
  delayMs = 1000,
}: HeroSoftRingProps) {
  return (
    <motion.div
      className={cn(
        "pointer-events-none absolute -left-8 -top-3 z-0 hidden h-14 w-14 rounded-full border-[10px] sm:block sm:-left-[68px] sm:-top-[10px] sm:h-[94px] sm:w-[94px] sm:border-[14px] lg:-left-[72px] lg:-top-[12px] lg:h-[100px] lg:w-[100px] lg:border-[15px]",
        className,
      )}
      style={{ borderColor: color }}
      variants={heroFadeIn}
      initial="hidden"
      animate="visible"
      transition={heroAnim(delayMs)}
      aria-hidden
    />
  );
}

type HeroAccentRingProps = {
  color: string;
  className?: string;
};

/** Solid accent ring on the media column (behind banner). */
export function HeroAccentRing({ color, className }: HeroAccentRingProps) {
  return (
    <motion.div
      className={cn(
        "h-[95px] w-[95px] rounded-full border-[14px] lg:h-[110px] lg:w-[110px] lg:border-[16px]",
        className,
      )}
      style={{ borderColor: color }}
      animate={{ scale: [1, 1.04, 1], opacity: [0.9, 1, 0.9] }}
      transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      aria-hidden
    />
  );
}
