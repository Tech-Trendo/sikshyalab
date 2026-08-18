"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Section,
  SectionContainer,
  SectionEyebrow,
  SectionSwoosh,
} from "@/components/brand/Section";
import { DynamicHeading } from "@/components/brand/DynamicHeading";
import RevealOnScroll, { THEME_DELAY } from "@/components/motion/RevealOnScroll";
import { usePublicData } from "@/hooks/usePublicData";
import { TestimonialCard } from "@/components/testimonials/TestimonialCard";
import type { SiteTestimonial } from "@/lib/testimonials";

const PAGE_SIZE = 2;
const AUTO_MS = 4000;

/** Brand-navy rounded dot cluster — top-right behind cards */
function CoralDotGrid({ className }: { className?: string }) {
  return (
    <div
      className={className}
      style={{
        backgroundImage:
          "radial-gradient(circle, var(--color-brand-navy) 2.5px, transparent 2.7px)",
        backgroundSize: "13px 13px",
        WebkitMaskImage:
          "radial-gradient(ellipse 72% 72% at 50% 50%, #000 55%, transparent 72%)",
        maskImage:
          "radial-gradient(ellipse 72% 72% at 50% 50%, #000 55%, transparent 72%)",
      }}
      aria-hidden
    />
  );
}

function NavBtn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid h-12 w-12 place-items-center rounded-full bg-white text-heading shadow-brand-soft transition hover:-translate-y-0.5 hover:shadow-brand-med"
    >
      {children}
    </button>
  );
}

/**
 * Testimonials — always 2 card slots; when many exist, auto-round pages in place.
 * Eyebrow / heading come from CMS Site settings (testimonials_*).
 */
export function Testimonials() {
  const { testimonials, settings } = usePublicData();
  const list = testimonials;

  const eyebrow = settings?.testimonials_eyebrow?.trim() || "";
  const heading = settings?.testimonials_heading?.trim() || "";

  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const [page, setPage] = useState(0);
  const [dir, setDir] = useState(1);
  const hoveringRef = useRef(false);
  const pageRef = useRef(0);
  pageRef.current = page;

  const goTo = useCallback(
    (next: number, direction: number) => {
      const normalized = ((next % totalPages) + totalPages) % totalPages;
      setDir(direction);
      setPage(normalized);
    },
    [totalPages],
  );

  const goPrev = useCallback(() => goTo(pageRef.current - 1, -1), [goTo]);
  const goNext = useCallback(() => goTo(pageRef.current + 1, 1), [goTo]);

  useEffect(() => {
    if (totalPages <= 1) return;
    const id = window.setInterval(() => {
      if (hoveringRef.current) return;
      goNext();
    }, AUTO_MS);
    return () => window.clearInterval(id);
  }, [goNext, totalPages]);

  if (!list.length) return null;

  const visible = list.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  return (
    <Section id="testimonials" className="!overflow-visible !bg-white">
      <SectionContainer className="relative overflow-visible">
        <div
          className="pointer-events-none absolute left-1/2 top-[16%] z-0 hidden h-[400px] w-[400px] -translate-x-1/2 rounded-full lg:block xl:h-[440px] xl:w-[440px]"
          style={{
            background:
              "radial-gradient(circle at 50% 35%, color-mix(in oklab, var(--color-brand-shade) 80%, #E8EBEE) 0%, var(--color-brand-shade) 42%, #F7F8F9 68%, #FFFFFF 100%)",
          }}
          aria-hidden
        />

        {(eyebrow || heading) && (
          <div className="relative z-[1] mx-auto mb-8 max-w-2xl text-center lg:mb-9">
            {eyebrow ? <SectionEyebrow className="mb-3">{eyebrow}</SectionEyebrow> : null}
            {heading ? (
              <DynamicHeading
                as="h2"
                text={heading}
                className="font-heading text-[1.85rem] font-bold leading-[1.25] tracking-tight text-heading sm:text-[2.35rem] lg:text-[2.5rem]"
              />
            ) : null}
            <SectionSwoosh className="mx-auto mt-2.5" />
          </div>
        )}

        <RevealOnScroll
          variant="fade-up"
          delay={THEME_DELAY.body}
          className="relative z-[1] -mt-1 overflow-visible lg:px-14 xl:px-20"
        >
          <motion.div
            className="pointer-events-none absolute -left-3 -top-10 z-20 hidden w-[128px] lg:block xl:-left-6 xl:-top-12 xl:w-[158px]"
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 4.8, repeat: Infinity, ease: "easeInOut" }}
            aria-hidden
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/theme/testimonial-char-3d.png"
              alt=""
              className="h-auto w-full select-none drop-shadow-[0_16px_28px_rgba(27,58,107,0.14)]"
              draggable={false}
            />
          </motion.div>

          <div
            className="pointer-events-none absolute -right-4 -top-6 z-20 hidden h-[180px] w-[170px] lg:block xl:-right-6 xl:-top-8"
            aria-hidden
          >
            <CoralDotGrid className="absolute left-2 top-4 h-[120px] w-[120px] opacity-95" />
            <motion.img
              src="/images/theme/testimonial-squiggle-3d.png"
              alt=""
              className="absolute -right-1 top-8 h-[115px] w-auto select-none drop-shadow-[0_12px_20px_rgba(100,140,180,0.28)]"
              draggable={false}
              animate={{ y: [0, -7, 0], rotate: [0, 4, 0] }}
              transition={{ duration: 5.6, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>

          <div
            className="relative z-10 mx-auto w-fit max-w-full"
            onMouseEnter={() => {
              hoveringRef.current = true;
            }}
            onMouseLeave={() => {
              hoveringRef.current = false;
            }}
          >
            <div className="relative min-h-[240px] w-full max-w-[910px]">
              <AnimatePresence mode="wait" custom={dir}>
                <motion.div
                  key={page}
                  custom={dir}
                  initial={{ opacity: 0, x: dir > 0 ? 36 : -36 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: dir > 0 ? -36 : 36 }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                  className="grid grid-cols-1 gap-[5px] md:grid-cols-2"
                >
                  {visible.map((t: SiteTestimonial) => (
                    <TestimonialCard key={t.id} testimonial={t} />
                  ))}
                </motion.div>
              </AnimatePresence>
            </div>

            {totalPages > 1 ? (
              <div className="mt-9 flex items-center justify-center gap-3">
                <NavBtn label="Previous testimonials" onClick={goPrev}>
                  <ArrowLeft className="h-5 w-5" strokeWidth={1.75} />
                </NavBtn>
                <NavBtn label="Next testimonials" onClick={goNext}>
                  <ArrowRight className="h-5 w-5" strokeWidth={1.75} />
                </NavBtn>
              </div>
            ) : null}
          </div>
        </RevealOnScroll>
      </SectionContainer>
    </Section>
  );
}
