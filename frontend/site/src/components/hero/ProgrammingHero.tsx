"use client";

import type { CSSProperties } from "react";
import { HERO_IMAGES } from "@/components/brand/hero-images";
import { SectionContainer } from "@/components/brand/Section";
import { MouseTrackProvider } from "@/components/brand/useMouseTrack";
import { HeroCopy } from "@/components/hero/HeroCopy";
import { HeroWaveBand } from "@/components/hero/HeroDecor";
import { HeroMedia } from "@/components/hero/HeroMedia";
import {
  DEFAULT_HERO_DOTS,
  DEFAULT_HERO_FLOATS,
  DEFAULT_HERO_SUBTITLE,
  DEFAULT_HERO_TITLE,
  HERO_COLORS,
  buildDefaultStats,
  type ProgrammingHeroProps,
} from "@/components/hero/types";
import { cn } from "@/lib/utils";

/** Programming hero — composes reusable copy + media blocks. */
export function ProgrammingHero({
  titleParts = DEFAULT_HERO_TITLE,
  subtitle = DEFAULT_HERO_SUBTITLE,
  ctaLabel = "Find courses",
  ctaHref = "/courses",
  imageSrc = HERO_IMAGES.programmingBanner,
  imageAlt = "Programming student with laptop",
  imageWidth = 511,
  imageHeight = 713,
  waveBgSrc = HERO_IMAGES.programmingBg,
  zigzagSrc = HERO_IMAGES.shape15,
  stats = buildDefaultStats(0),
  floatItems = DEFAULT_HERO_FLOATS,
  dots = DEFAULT_HERO_DOTS,
  colors: colorOverrides,
  showZigzag = true,
  showRing = true,
  showAccentRing = true,
  className,
}: ProgrammingHeroProps) {
  const colors = { ...HERO_COLORS, ...colorOverrides };

  return (
    <MouseTrackProvider
      className={cn("relative w-full overflow-x-clip bg-white", className)}
      style={
        {
          ["--hero-orange"]: colors.orange,
          ["--hero-coral"]: colors.orange,
          ["--hero-ink"]: colors.ink,
        } as CSSProperties
      }
    >
      {/* Full-bleed wave — outside content container */}
      <HeroWaveBand src={waveBgSrc} />

      {/* Same max-width + padding as header/footer */}
      <SectionContainer className="relative z-[1] pb-16 pt-[calc(var(--site-header-height,8.5rem)+2.5rem)] sm:pb-24 sm:pt-[calc(var(--site-header-height,9rem)+3.5rem)] lg:pb-28 lg:pt-[calc(var(--site-header-height,9rem)+4rem)]">
        <div className="grid items-start gap-8 lg:grid-cols-2 lg:items-stretch lg:gap-6 xl:gap-2">
          <HeroCopy
            titleParts={titleParts}
            subtitle={subtitle}
            ctaLabel={ctaLabel}
            ctaHref={ctaHref}
            stats={stats}
            accentColor={colors.orange}
            inkColor={colors.ink}
            showZigzag={showZigzag}
            showRing={showRing}
            zigzagSrc={zigzagSrc}
            ringColor="rgba(27,58,107,0.22)"
          />

          <HeroMedia
            imageSrc={imageSrc}
            imageAlt={imageAlt}
            imageWidth={imageWidth}
            imageHeight={imageHeight}
            floatItems={floatItems}
            dots={dots}
            accentRingColor={colors.coral}
            showAccentRing={showAccentRing}
          />
        </div>
      </SectionContainer>
    </MouseTrackProvider>
  );
}
