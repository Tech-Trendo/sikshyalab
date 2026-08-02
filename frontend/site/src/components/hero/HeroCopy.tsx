"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import {
  heroAnim,
  heroSlideUp,
} from "@/components/brand/hero-animations";
import { HeroSoftRing, HeroZigzag } from "@/components/hero/HeroDecor";
import { HeroStat } from "@/components/hero/HeroParts";
import type { HeroStatItem, HeroTitlePart } from "@/components/hero/types";
import { cn } from "@/lib/utils";

type HeroTitleProps = {
  parts: HeroTitlePart[];
  accentColor: string;
  inkColor?: string;
  className?: string;
};

/** Dynamic multi-line hero heading from `titleParts`. */
export function HeroTitle({
  parts,
  accentColor,
  inkColor = "#181818",
  className,
}: HeroTitleProps) {
  return (
    <motion.h1
      className={cn(
        "relative z-[1] font-heading text-[30px] font-bold leading-[1.2] tracking-[-0.01em] sm:text-[44px] lg:text-[50px]",
        className,
      )}
      style={{ color: inkColor }}
      variants={heroSlideUp}
      initial="hidden"
      animate="visible"
      transition={heroAnim(150)}
    >
      {parts.map((part, i) => (
        <span key={`${part.text}-${i}`}>
          <span
            className={part.accent ? "md:whitespace-nowrap" : undefined}
            style={part.accent ? { color: accentColor } : undefined}
          >
            {part.text}
          </span>
          {part.breakAfter ? <br /> : null}
        </span>
      ))}
    </motion.h1>
  );
}

type HeroCtaProps = {
  label: string;
  href: string;
  className?: string;
};

export function HeroCta({ label, href, className }: HeroCtaProps) {
  return (
    <motion.div
      className={cn("mt-7 w-full sm:mt-8 sm:w-auto", className)}
      variants={heroSlideUp}
      initial="hidden"
      animate="visible"
      transition={heroAnim(400)}
    >
      <Link
        href={href}
        className="sl-hero-btn group w-full !rounded-[5px] sm:w-auto"
      >
        {label}
        <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
      </Link>
    </motion.div>
  );
}

type HeroStatsRowProps = {
  stats: HeroStatItem[];
  textColor: string;
  className?: string;
};

export function HeroStatsRow({ stats, textColor, className }: HeroStatsRowProps) {
  if (!stats.length) return null;

  return (
    <motion.div
      className={cn(
        "relative z-10 mt-10 flex flex-col items-start gap-5 sm:mt-12 sm:flex-row sm:items-center sm:gap-6 lg:mt-auto lg:gap-8 lg:pt-16",
        className,
      )}
      variants={heroSlideUp}
      initial="hidden"
      animate="visible"
      transition={heroAnim(500)}
    >
      {stats.map((stat) => (
        <HeroStat
          key={stat.id}
          value={stat.value}
          label={stat.label}
          icon={stat.icon}
          iconColor={stat.iconColor}
          textColor={textColor}
        />
      ))}
    </motion.div>
  );
}

type HeroCopyProps = {
  titleParts: HeroTitlePart[];
  subtitle: string;
  ctaLabel: string;
  ctaHref: string;
  stats: HeroStatItem[];
  accentColor: string;
  inkColor: string;
  showZigzag?: boolean;
  showRing?: boolean;
  zigzagSrc?: string;
  ringColor?: string;
  className?: string;
};

/** Left column: title, subtitle, CTA, stats. */
export function HeroCopy({
  titleParts,
  subtitle,
  ctaLabel,
  ctaHref,
  stats,
  accentColor,
  inkColor,
  showZigzag = true,
  showRing = true,
  zigzagSrc,
  ringColor = "rgba(238,74,98,0.22)",
  className,
}: HeroCopyProps) {
  return (
    <div
      className={cn(
        "relative z-10 flex h-full w-full max-w-[560px] flex-col text-left",
        "pt-8 sm:pt-12 sm:-ml-6 lg:pt-16 lg:-ml-12 xl:-ml-16",
        className,
      )}
    >
      <div
        className={cn(
          "relative z-10",
          showZigzag && "sm:pl-[72px] lg:pl-[80px]",
        )}
      >
        {showZigzag ? (
          <HeroZigzag src={zigzagSrc} className="sm:!-left-3 lg:!-left-5" />
        ) : null}

        <div className="relative">
          {showRing ? <HeroSoftRing color={ringColor} /> : null}
          <HeroTitle parts={titleParts} accentColor={accentColor} inkColor={inkColor} />
        </div>

        <motion.p
          className="mt-6 max-w-[420px] font-body text-[15px] font-normal leading-[1.7] sm:mt-9 sm:text-[16px]"
          style={{ color: inkColor }}
          variants={heroSlideUp}
          initial="hidden"
          animate="visible"
          transition={heroAnim(250)}
        >
          {subtitle}
        </motion.p>

        <HeroCta label={ctaLabel} href={ctaHref} />
      </div>

      <HeroStatsRow stats={stats} textColor={inkColor} />
    </div>
  );
}
