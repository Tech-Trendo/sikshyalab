"use client";

import { CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import RevealOnScroll from "@/components/motion/RevealOnScroll";
import { MouseTrackItem, MouseTrackProvider } from "@/components/brand/useMouseTrack";
import { SectionContainer, SectionEyebrow } from "@/components/brand/Section";

type Props = {
  headingLead?: string;
  headingAccent?: string;
  headingTail?: string;
  body?: string;
  checks?: readonly string[] | string[];
  mainImage?: string;
  overlayImage?: string;
};

export function AboutIntro({
  headingLead = "About",
  headingAccent = "ShikshaLab",
  headingTail = "",
  body = "",
  checks = [],
  mainImage = "",
  overlayImage = "",
}: Props) {
  if (!body && !mainImage && !checks.length) return null;

  return (
    <MouseTrackProvider className="section-y relative overflow-hidden bg-white">
      <SectionContainer className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <RevealOnScroll variant="fade-up" delay={0.05}>
          <SectionEyebrow align="left">About Us</SectionEyebrow>
          <h2 className="font-heading text-[1.75rem] font-bold leading-snug text-[#181818] sm:text-3xl lg:text-[2.35rem]">
            {headingLead}{" "}
            <span className="text-brand-navy">{headingAccent}</span> {headingTail}
          </h2>
          <span
            className="mt-3 inline-block h-[3px] w-14 rounded-full bg-brand-gradient"
            aria-hidden
          />
          {body ? (
            <p className="mt-5 max-w-lg font-body text-[15px] leading-relaxed text-brand-body">{body}</p>
          ) : null}
          {checks.length > 0 ? (
            <ul className="mt-7 space-y-3.5">
              {checks.map((item) => (
                <li
                  key={item}
                  className="flex items-center gap-3 text-[15px] font-semibold text-heading"
                >
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-brand-orange" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          ) : null}
        </RevealOnScroll>

        {mainImage ? (
          <RevealOnScroll
            variant="slide-down"
            delay={0.15}
            className="relative mx-auto w-full max-w-lg lg:max-w-none"
          >
            <MouseTrackItem depth={1.2} className="absolute -left-8 -top-6 z-0 hidden lg:block">
              <div className="h-40 w-40 rounded-full bg-brand-orange/15 blur-[2px]" />
            </MouseTrackItem>
            <MouseTrackItem depth={-1} className="absolute -bottom-10 -right-6 z-0 hidden lg:block">
              <div className="h-48 w-48 rounded-[40%] bg-brand-navy/10" />
            </MouseTrackItem>
            <MouseTrackItem depth={0.8} className="absolute right-8 top-1/3 z-0 hidden lg:block">
              <div className="h-24 w-24 rounded-full border-[12px] border-brand-orange/20" />
            </MouseTrackItem>

            <div className="relative z-[1]">
              <div className="overflow-hidden rounded-[10px] shadow-brand-med">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mainImage} alt="" className="aspect-[5/4] w-full object-cover" />
              </div>
              {overlayImage ? (
                <motion.div
                  className="absolute -left-4 -top-6 w-[48%] overflow-hidden rounded-[10px] border-4 border-white shadow-brand-soft sm:-left-8 sm:-top-10"
                  initial={{ opacity: 0, y: -20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.25 }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={overlayImage} alt="" className="aspect-square w-full object-cover" />
                </motion.div>
              ) : null}
            </div>
          </RevealOnScroll>
        ) : null}
      </SectionContainer>
    </MouseTrackProvider>
  );
}
