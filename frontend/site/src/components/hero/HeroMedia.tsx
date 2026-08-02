"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import {
  heroAnim,
  heroFloatAnim,
  heroSlideLeft,
} from "@/components/brand/hero-animations";
import { MouseTrackItem } from "@/components/brand/useMouseTrack";
import { HeroAccentRing } from "@/components/hero/HeroDecor";
import { HeroDotCluster, HeroFloatIcon } from "@/components/hero/HeroParts";
import type { HeroDotItem, HeroFloatItem } from "@/components/hero/types";
import { cn } from "@/lib/utils";

type HeroMediaProps = {
  imageSrc: string;
  imageAlt: string;
  imageWidth?: number;
  imageHeight?: number;
  floatItems?: HeroFloatItem[];
  dots?: HeroDotItem[];
  accentRingColor?: string;
  showAccentRing?: boolean;
  className?: string;
};

/** Right column: dots, accent ring, banner image, float badges. */
export function HeroMedia({
  imageSrc,
  imageAlt,
  imageWidth = 511,
  imageHeight = 713,
  floatItems = [],
  dots = [],
  accentRingColor,
  showAccentRing = true,
  className,
}: HeroMediaProps) {
  const bannerFloat = heroFloatAnim(0.2, 10, 5.5, 0);

  return (
    <div
      className={cn(
        "relative z-[5] mx-auto min-h-[280px] w-full max-w-[480px] sm:min-h-[340px] lg:ml-auto lg:mr-0 lg:min-h-[560px] lg:max-w-[500px]",
        className,
      )}
    >
      {dots.map((dot) => (
        <HeroDotCluster
          key={dot.id}
          color={dot.color}
          className={dot.className}
          size={dot.size}
        />
      ))}

      {showAccentRing && accentRingColor ? (
        <MouseTrackItem
          depth={0.3}
          className="pointer-events-none absolute right-[-4%] top-[22%] z-[1] hidden sm:block lg:right-[-6%] lg:top-[24%]"
        >
          <HeroAccentRing color={accentRingColor} />
        </MouseTrackItem>
      ) : null}

      <motion.div
        className="relative z-[4] mx-auto w-full max-w-[460px] lg:mx-0 lg:ml-auto"
        variants={heroSlideLeft}
        initial="hidden"
        animate="visible"
        transition={heroAnim(500)}
      >
        <motion.div animate={bannerFloat.animate} transition={bannerFloat.transition}>
          <Image
            src={imageSrc}
            alt={imageAlt}
            width={imageWidth}
            height={imageHeight}
            className="h-auto w-full object-contain"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 480px, 500px"
            priority
            unoptimized
          />
        </motion.div>
      </motion.div>

      {floatItems.map((item) => (
        <HeroFloatIcon
          key={item.id}
          src={item.src}
          alt={item.alt}
          className={item.className}
          delay={item.delay}
          distance={item.distance}
          duration={item.duration}
          depth={item.depth}
          inFront={item.inFront}
        />
      ))}
    </div>
  );
}
