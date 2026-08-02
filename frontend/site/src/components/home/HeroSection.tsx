"use client";

import Link from "next/link";
import { BookOpen, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import RevealOnScroll from "@/components/motion/RevealOnScroll";
import { usePublicData } from "@/hooks/usePublicData";
import { HERO_IMAGES } from "@/components/brand/hero-images";

/** Alternate hero layout — brand tokens + RevealOnScroll animations. */
export function HeroSection() {
  const { courses, hero } = usePublicData();
  const courseCount = courses.length;

  return (
    <section className="relative overflow-hidden bg-brand-shade">
      <RevealOnScroll variant="fade-in" delay={1.0}>
        <span className="pointer-events-none absolute -left-16 top-24 h-40 w-40 rounded-full bg-brand-orange/10" />
        <span className="pointer-events-none absolute -right-20 top-10 h-72 w-72 rounded-full bg-brand-navy/[0.07]" />
      </RevealOnScroll>

      <div className="container-page relative grid items-center gap-10 pb-16 pt-16 md:grid-cols-2 md:gap-8 md:pb-24 md:pt-24 lg:gap-12">
        <RevealOnScroll variant="slide-left" delay={0.25} className="relative z-10 max-w-xl">
          <h1 className="font-secondary text-[2.15rem] font-bold leading-[1.18] tracking-tight text-brand-navy-dark sm:text-4xl md:text-[2.85rem] lg:text-[3.25rem]">
            {hero.title.includes("ShikshaLab") ? (
              hero.title
            ) : (
              <>
                {hero.title} <span className="text-brand-navy">ShikshaLab</span>
              </>
            )}
          </h1>
          <p className="mt-6 max-w-md text-[15px] leading-relaxed text-brand-body sm:text-base">
            {hero.subtitle}
          </p>
          <RevealOnScroll variant="fade-up" delay={0.4} className="mt-8">
            <Button
              asChild
              className="h-12 rounded-brand bg-brand-gradient px-8 text-[15px] font-semibold text-brand-navy-dark shadow-none transition-colors duration-brand ease-in-out hover:brightness-105"
            >
              <Link href={hero.ctaUrl || "/courses"}>{hero.ctaText || "Find courses"}</Link>
            </Button>
          </RevealOnScroll>
        </RevealOnScroll>

        <RevealOnScroll variant="slide-right" delay={0.5} className="relative mx-auto w-full max-w-lg md:max-w-none">
          <div className="relative aspect-[4/4.2] overflow-hidden rounded-[40%_40%_12px_12px] sm:aspect-[5/5.2] md:rounded-[45%_45%_16px_16px]">
            <img
              src={hero.image || HERO_IMAGES.programmingBanner}
              alt="Students learning at ShikshaLab"
              className="h-full w-full object-cover"
            />
          </div>

          {courseCount > 0 && (
            <div className="absolute -left-2 bottom-10 z-10 flex max-w-[200px] items-center gap-3 rounded-brand bg-white p-4 shadow-brand-soft sm:-left-6 sm:bottom-16">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-brand-lighten-02 text-brand-navy">
                <BookOpen className="h-5 w-5" />
              </span>
              <div>
                <p className="font-secondary text-lg font-bold leading-none text-brand-navy-dark">
                  {courseCount}+
                </p>
                <p className="mt-1 text-xs font-semibold text-brand-body">Online courses</p>
              </div>
            </div>
          )}

          <div className="absolute -right-1 top-16 z-10 flex max-w-[200px] items-center gap-3 rounded-brand bg-white p-4 shadow-brand-soft sm:-right-4 sm:top-20">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-brand-lighten-02 text-brand-navy">
              <Award className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-bold leading-snug text-brand-navy-dark">Verified Certs</p>
              <p className="mt-1 text-xs font-semibold text-brand-body">QR-checkable</p>
            </div>
          </div>
        </RevealOnScroll>
      </div>
    </section>
  );
}
