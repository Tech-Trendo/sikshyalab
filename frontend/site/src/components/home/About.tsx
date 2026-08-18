"use client";

import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { motion } from "framer-motion";
import {
  Section,
  SectionContainer,
  SectionEyebrow,
  SectionSwoosh,
  RevealLeft,
  RevealRight,
} from "@/components/brand/Section";
import RevealOnScroll, { THEME_DELAY, STAGGER_STEP } from "@/components/motion/RevealOnScroll";
import RingDotDecor from "@/components/RingDotDecor";
import { usePublicData } from "@/hooks/usePublicData";
import { parseAboutCms } from "@/lib/about-cms";

/** Brand tokens (logo: navy) */
const NAVY = "#1B3A6B";
const INK = "#14213D";
const SHADE = "#EAF0F6";

const DEFAULT_IMAGE = "/images/theme/about-26.webp";

function AboutBlob({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 320 280" fill="none" aria-hidden>
      <path
        d="M40 140C40 70 95 20 170 28C245 36 300 90 292 160C284 230 220 270 145 262C70 254 40 210 40 140Z"
        fill={SHADE}
      />
    </svg>
  );
}

/** About section — ShikshaLab navy. Hidden until CMS about content exists. */
export function About({ showCta = true }: { showCta?: boolean }) {
  const { aboutPage, settings } = usePublicData();
  const cms = parseAboutCms(aboutPage?.content);
  const title = aboutPage?.title?.trim() || "";
  const intro = cms.intro.trim();
  const fallbackBody = settings?.tagline?.trim() || "";
  const contentLines = intro
    ? intro.split(/\n+/).map((line) => line.replace(/^[-•*]\s*/, "").trim()).filter(Boolean)
    : [];
  const body = contentLines[0] || fallbackBody;
  const points = contentLines.slice(1, 3);

  if (!title && !body) return null;

  const image = aboutPage?.featured_image || DEFAULT_IMAGE;
  // Home teaser stays short; About page shows the full intro paragraph.
  const bodyDisplay = showCta && body.length > 220 ? `${body.slice(0, 220).trim()}…` : body;

  return (
    <Section className="!overflow-visible !bg-white">
      <SectionContainer className="grid items-center gap-12 overflow-visible lg:grid-cols-2 lg:gap-[70px]">
        <RevealRight delay={THEME_DELAY.slideRight} className="relative mx-auto w-full max-w-[520px] overflow-visible lg:mx-0">
          <motion.div
            className="pointer-events-none absolute -bottom-8 -right-6 z-0 hidden w-[70%] max-w-[300px] sm:block lg:-right-10"
            animate={{ y: [0, -8, 0], x: [0, 4, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            aria-hidden
          >
            <AboutBlob className="h-auto w-full" />
          </motion.div>

          <motion.span
            className="pointer-events-none absolute -bottom-3 right-2 z-0 hidden h-[88px] w-[88px] rounded-full sm:block lg:right-4"
            style={{ backgroundColor: NAVY }}
            animate={{ scale: [1, 1.06, 1] }}
            transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
            aria-hidden
          />

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/theme/shape-25-1.png"
            alt=""
            className="sl-float-y-sm pointer-events-none absolute -left-6 bottom-16 z-[2] hidden h-auto w-10 opacity-80 lg:block"
            draggable={false}
          />

          {/* Dots behind frame · ring on corner — tune with dotSpacing / dotOffset */}
          <RingDotDecor dotSpacing={12} dotOffset={48}>
            <div className="relative z-10 rounded-[5px] bg-white p-5 shadow-brand-soft sm:rounded-[10px] sm:p-[30px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image}
                alt="Students learning programming"
                className="aspect-[600/413] w-full rounded-[5px] object-cover"
              />
            </div>
          </RingDotDecor>
        </RevealRight>

        <RevealLeft delay={THEME_DELAY.heading} className="relative">
          <SectionEyebrow align="left" className="mb-2.5">About Us</SectionEyebrow>
          <h2
            className="text-left font-heading text-[1.85rem] font-bold leading-[1.3] tracking-tight sm:text-[2.35rem] lg:text-[2.5rem]"
            style={{ color: INK }}
          >
            {title || "About ShikshaLab"}
          </h2>
          <SectionSwoosh className="mx-0" />
          {bodyDisplay ? (
            <p className="mt-4 max-w-lg font-body text-[16px] leading-[1.75] text-[#181818] sm:text-[18px]">
              {bodyDisplay}
            </p>
          ) : null}

          {points.length > 0 ? (
            <ul className="mt-7 space-y-4">
              {points.map((item, i) => (
                <RevealOnScroll
                  key={item}
                  variant="fade-up"
                  delay={THEME_DELAY.cta + i * STAGGER_STEP}
                >
                  <li
                    className="flex items-center gap-3 font-body text-[16px] font-semibold"
                    style={{ color: INK }}
                  >
                    <Check
                      className="h-5 w-5 shrink-0 text-[#181818]"
                      strokeWidth={2.75}
                      aria-hidden
                    />
                    {item}
                  </li>
                </RevealOnScroll>
              ))}
            </ul>
          ) : null}

          {showCta ? (
            <RevealOnScroll variant="fade-up" delay={THEME_DELAY.cta + 0.25} className="mt-9">
              <Link
                href="/about"
                className="sl-hero-btn sl-hero-btn--yellow sl-hero-btn--no-color-hover group w-full !h-[50px] !min-h-[48px] !px-7 !text-[15px] sm:w-auto"
              >
                Learn More
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
              </Link>
            </RevealOnScroll>
          ) : null}
        </RevealLeft>
      </SectionContainer>
    </Section>
  );
}
