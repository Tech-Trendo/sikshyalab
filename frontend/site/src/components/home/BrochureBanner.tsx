"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Section, SectionContainer } from "@/components/brand/Section";
import RevealOnScroll, { THEME_DELAY } from "@/components/motion/RevealOnScroll";
import { useMouseParallax } from "@/hooks/useMouseParallax";

/** Home CTA — verify a ShikshaLab certificate by code. */
export function VerifyCertificateBanner() {
  const router = useRouter();
  const containerRef = useMouseParallax(20);
  const [code, setCode] = useState("");

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim();
    const qs = trimmed ? `?code=${encodeURIComponent(trimmed)}` : "";
    router.push(`/verify${qs}`);
  };

  return (
    <Section muted className="!py-12 lg:!py-14">
      <SectionContainer>
        <div
          ref={containerRef}
          className="relative grid items-center gap-8 lg:grid-cols-2 lg:gap-10"
        >
          <RevealOnScroll
            variant="slide-right"
            delay={THEME_DELAY.slideRight}
            className="relative mx-auto max-w-[300px]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/theme/shape-05.png"
              alt=""
              data-depth="1"
              className="pointer-events-none absolute -left-8 top-6 hidden h-auto w-8 opacity-70 transition-transform duration-300 ease-out lg:block"
              draggable={false}
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/theme/shape-31.png"
              alt=""
              data-depth="-0.8"
              className="pointer-events-none absolute -right-6 bottom-10 hidden h-auto w-10 opacity-70 transition-transform duration-300 ease-out lg:block"
              draggable={false}
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/theme/cta-programming-img.webp"
              alt="Verify ShikshaLab certificate"
              className="sl-float-y-sm relative z-[1] h-auto w-full"
              draggable={false}
            />
          </RevealOnScroll>

          <RevealOnScroll
            variant="slide-left"
            delay={THEME_DELAY.media}
            className="text-center lg:text-left"
          >
            <p className="mb-2 font-body text-xs font-semibold uppercase tracking-[1.5px] text-brand-orange">
              Verify Certificate
            </p>
            <h2 className="font-heading text-[26px] font-bold leading-snug text-[#181818] sm:text-[34px]">
              Confirm Your{" "}
              <span className="text-brand-navy">ShikshaLab Certificate</span>{" "}
              Instantly
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-brand-body sm:text-base">
              Enter the certificate code to check authenticity on our public
              verification page.
            </p>

            <form
              onSubmit={onSubmit}
              className="mt-7 flex w-full flex-col gap-3 md:flex-row md:items-center"
            >
              <label htmlFor="home-verify-code" className="sr-only">
                Certificate code
              </label>
              <input
                id="home-verify-code"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder=""
                className="h-[50px] w-full min-w-0 flex-1 rounded-[5px] border border-brand-border bg-white px-4 text-sm text-brand-navy-dark outline-none transition focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/20"
              />
              <button
                type="submit"
                className="sl-hero-btn w-full !h-[50px] !min-h-12 shrink-0 !px-8 md:w-auto"
              >
                Verify certificate
              </button>
            </form>
          </RevealOnScroll>
        </div>
      </SectionContainer>
    </Section>
  );
}

/** @deprecated Use VerifyCertificateBanner */
export const BrochureBanner = VerifyCertificateBanner;
