"use client";

import { useMemo } from "react";
import { ProgrammingHero } from "@/components/hero/ProgrammingHero";
import { parseHeroTitle } from "@/components/hero/parse-title";
import { buildDefaultStats } from "@/components/hero/types";
import { HERO_IMAGES } from "@/components/brand/hero-images";
import { usePublicData } from "@/hooks/usePublicData";

/**
 * Home hero — maps CMS / public API fields into the reusable ProgrammingHero.
 * Pass any override by rendering `<ProgrammingHero {...} />` directly.
 */
export function Hero() {
  const { hero, stats, settings } = usePublicData();

  const titleParts = useMemo(() => {
    const raw = hero.title?.trim();
    if (!raw) {
      const name = settings?.site_name?.trim() || "ShikshaLab";
      return [{ text: name }];
    }
    return parseHeroTitle(raw, { fallback: [{ text: raw }] });
  }, [hero.title, settings?.site_name]);

  const courseCount = useMemo(() => {
    const raw = stats.find((s) => s.id === "courses")?.value ?? 0;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [stats]);

  // Use the local theme student image for the homepage hero.
  const imageSrc = HERO_IMAGES.programmingBanner;

  return (
    <ProgrammingHero
      titleParts={titleParts}
      subtitle={hero.subtitle || ""}
      ctaLabel={hero.ctaText || "Find courses"}
      ctaHref={hero.ctaUrl || "/courses"}
      imageSrc={imageSrc}
      imageAlt="Student with laptop"
      stats={buildDefaultStats(courseCount)}
    />
  );
}
