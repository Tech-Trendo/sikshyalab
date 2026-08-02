"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Quote, Star } from "lucide-react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, EffectCoverflow } from "swiper/modules";
import type { Swiper as SwiperType } from "swiper";
import { PersonAvatar } from "@/components/brand/PersonAvatar";
import { SectionContainer, SectionEyebrow, SectionSwoosh } from "@/components/brand/Section";
import { DynamicHeading } from "@/components/brand/DynamicHeading";
import RevealOnScroll from "@/components/motion/RevealOnScroll";
import { usePublicData } from "@/hooks/usePublicData";
import "swiper/css";
import "swiper/css/effect-coverflow";

function DottedGrid({ className }: { className?: string }) {
  return (
    <div
      className={className}
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(5, 5px)",
        gap: "7px",
      }}
      aria-hidden
    >
      {Array.from({ length: 20 }).map((_, i) => (
        <span
          key={i}
          className="h-[5px] w-[5px] rounded-full bg-brand-orange/35"
        />
      ))}
    </div>
  );
}

export function AboutTestimonials() {
  const swiperRef = useRef<SwiperType | null>(null);
  const [active, setActive] = useState(0);
  const { testimonials, settings } = usePublicData();
  const list = testimonials.slice(0, 4);
  const eyebrow = settings?.testimonials_eyebrow?.trim() || "";
  const heading = settings?.testimonials_heading?.trim() || "";

  if (!list.length) return null;

  return (
    <section className="section-y relative overflow-hidden bg-white">
      <SectionContainer className="grid items-center gap-12 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.15fr)] lg:gap-10 xl:gap-14">
        <RevealOnScroll variant="fade-up" className="max-w-[420px]">
          {eyebrow ? (
            <SectionEyebrow align="left" className="mb-2.5">
              {eyebrow}
            </SectionEyebrow>
          ) : null}
          {heading ? (
            <DynamicHeading
              as="h2"
              text={heading}
              className="font-heading text-[1.75rem] font-bold leading-[1.25] text-heading sm:text-3xl lg:text-[2.5rem]"
            />
          ) : null}
          <SectionSwoosh className="mx-0 mt-2.5" />
          <p className="mt-5 font-body text-[15px] leading-[1.75] text-brand-body">
            Hear from graduates who built career-ready skills through live classes and real projects.
          </p>
          <Link
            href="/#testimonials"
            className="group mt-8 inline-flex h-[52px] items-center gap-2.5 rounded-full bg-brand-navy px-8 text-[15px] font-semibold !text-white shadow-[0_12px_28px_rgb(27_58_107/28%)] transition-all duration-300 hover:bg-brand-orange hover:shadow-[0_16px_36px_rgb(245_166_35/36%)]"
          >
            View all testimonials
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </RevealOnScroll>

        <RevealOnScroll
          variant="fade-up"
          delay={0.12}
          className="relative min-w-0"
        >
          {/* Soft circular backdrop behind carousel */}
          <span
            className="pointer-events-none absolute left-1/2 top-1/2 z-0 hidden h-[340px] w-[340px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-brand-border/60 lg:block"
            aria-hidden
          />

          <div className="about-testimonials-stage relative z-[1] mx-auto max-w-[560px] overflow-hidden px-2 sm:px-4">
            <Swiper
              modules={[Autoplay, EffectCoverflow]}
              effect="coverflow"
              grabCursor
              centeredSlides
              loop
              slidesPerView="auto"
              spaceBetween={0}
              coverflowEffect={{
                rotate: 0,
                stretch: 70,
                depth: 160,
                modifier: 1.4,
                slideShadows: false,
              }}
              autoplay={{
                delay: 4500,
                disableOnInteraction: false,
                pauseOnMouseEnter: true,
              }}
              onSwiper={(s) => {
                swiperRef.current = s;
              }}
              onSlideChange={(s) => setActive(s.realIndex)}
              className="about-testimonials-coverflow !overflow-visible !py-4"
            >
              {list.map((t, i) => (
                <SwiperSlide
                  key={"id" in t && t.id ? String(t.id) : `${t.name}-${i}`}
                  className="!h-auto !w-[82%] sm:!w-[70%]"
                >
                  <article className="about-testimonials-card relative overflow-hidden rounded-[10px] bg-white px-7 py-9 sm:px-8 sm:py-10">
                    <DottedGrid className="about-testimonials-dots pointer-events-none absolute right-6 top-6 z-0" />

                    <div className="relative z-[1] mb-5 inline-block">
                      <PersonAvatar
                        src={t.avatar}
                        name={t.name}
                        size={70}
                        className="h-[70px] w-[70px]"
                      />
                      <span className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full bg-brand-orange text-white shadow-[0_6px_14px_color-mix(in_srgb,var(--color-brand-orange)_35%,transparent)]">
                        <Quote className="h-3.5 w-3.5 fill-white" aria-hidden />
                      </span>
                    </div>

                    <p className="relative z-[1] font-body text-[15px] leading-[1.75] text-brand-body line-clamp-4">
                      {t.quote}
                    </p>

                    <div
                      className="relative z-[1] mt-5 flex gap-1"
                      aria-label={`${Math.min(5, Math.max(1, Math.round(t.rating || 5)))} out of 5 stars`}
                    >
                      {Array.from({
                        length: Math.min(5, Math.max(1, Math.round(t.rating || 5))),
                      }).map((_, si) => (
                        <Star
                          key={si}
                          className="h-3.5 w-3.5 fill-brand-orange text-brand-orange"
                        />
                      ))}
                    </div>

                    <p className="relative z-[1] mt-4 font-heading text-lg font-bold text-heading">
                      {t.name}
                    </p>
                    <p className="relative z-[1] mt-0.5 text-sm text-brand-body">
                      {t.role}
                    </p>
                  </article>
                </SwiperSlide>
              ))}
            </Swiper>
          </div>

          <div
            className="relative z-[1] mt-6 flex justify-center gap-2.5"
            role="tablist"
            aria-label="Testimonial slides"
          >
            {list.map((_, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={active === i}
                aria-label={`Go to review ${i + 1}`}
                onClick={() => swiperRef.current?.slideToLoop(i)}
                className={
                  active === i
                    ? "h-2.5 w-2.5 rounded-full bg-brand-orange transition-colors duration-brand"
                    : "h-2.5 w-2.5 rounded-full bg-brand-orange/20 transition-colors duration-brand"
                }
              />
            ))}
          </div>
        </RevealOnScroll>
      </SectionContainer>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        .about-testimonials-stage {
          mask-image: linear-gradient(90deg, transparent 0%, #000 8%, #000 92%, transparent 100%);
          -webkit-mask-image: linear-gradient(90deg, transparent 0%, #000 8%, #000 92%, transparent 100%);
        }
        .about-testimonials-coverflow .swiper-wrapper {
          align-items: center;
        }
        .about-testimonials-coverflow .swiper-slide {
          opacity: 0.35;
          transition: opacity 0.4s ease;
        }
        .about-testimonials-coverflow .swiper-slide-active {
          opacity: 1 !important;
          z-index: 5;
        }
        .about-testimonials-coverflow .swiper-slide-prev,
        .about-testimonials-coverflow .swiper-slide-next {
          opacity: 0.55;
          z-index: 2;
        }
        .about-testimonials-card {
          box-shadow: 0 10px 40px rgba(27, 58, 107, 0.12);
          transition: transform 0.35s ease, box-shadow 0.35s ease;
        }
        .about-testimonials-coverflow .swiper-slide-active .about-testimonials-card {
          box-shadow: 0 18px 50px rgba(27, 58, 107, 0.16);
        }
        .about-testimonials-coverflow .swiper-slide:not(.swiper-slide-active) .about-testimonials-dots {
          opacity: 0.4;
        }
      `,
        }}
      />
    </section>
  );
}
