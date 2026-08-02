"use client";

import Link from "next/link";
import { Section, SectionContainer } from "@/components/brand/Section";
import RevealOnScroll, { THEME_DELAY } from "@/components/motion/RevealOnScroll";
import { usePublicData } from "@/hooks/usePublicData";

/** Alternate CTA — navy panel + orange button only (no full-orange block). */
export function CtaBanner() {
  const { cta } = usePublicData();

  return (
    <Section>
      <SectionContainer>
        <RevealOnScroll variant="fade-up" delay={THEME_DELAY.heading}>
          <div className="relative overflow-hidden rounded-brand-lg bg-brand-navy px-6 py-16 text-center sm:px-10 md:py-24">
            <span
              className="pointer-events-none absolute -left-10 bottom-0 h-40 w-40 rounded-full bg-brand-orange/10"
              aria-hidden
            />
            <span
              className="pointer-events-none absolute -right-8 top-0 h-32 w-32 rounded-full bg-white/10"
              aria-hidden
            />

            <h2 className="relative mx-auto max-w-2xl font-secondary text-3xl font-bold text-white sm:text-4xl">
              {cta.title}
            </h2>
            <p className="relative mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-white/80">
              {cta.description}
            </p>
            <RevealOnScroll variant="fade-up" delay={THEME_DELAY.cta}>
              <Link
                href={cta.ctaUrl}
                className="relative mt-8 inline-flex h-12 items-center rounded-brand bg-brand-gradient px-8 text-[15px] font-semibold text-brand-navy-dark transition-colors duration-brand ease-in-out hover:brightness-105"
              >
                {cta.ctaText}
              </Link>
            </RevealOnScroll>
          </div>
        </RevealOnScroll>
      </SectionContainer>
    </Section>
  );
}
