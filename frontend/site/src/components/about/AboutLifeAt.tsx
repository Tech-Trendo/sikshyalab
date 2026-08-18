"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import RevealOnScroll from "@/components/motion/RevealOnScroll";
import { SectionContainer, SectionSwoosh } from "@/components/brand/Section";
import type { AboutLifeAt } from "@/lib/about-cms";

const FALLBACK_IMAGE = "/images/theme/about-26.webp";

function LifeAtHeading({ title }: { title: string }) {
  const parts = title.split(/(ShikshaLab)/i);
  if (parts.length === 1) return <>{title}</>;

  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === "shikshalab" ? (
          <span key={i} className="text-brand-navy">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}

export function AboutLifeAt({
  heading,
  description,
  image,
}: AboutLifeAt) {
  const title = heading.trim() || "Life at ShikshaLab";
  const body = description.trim();
  const src = image?.trim() || FALLBACK_IMAGE;
  if (!body && !image?.trim()) return null;

  return (
    <section className="section-y bg-white">
      <SectionContainer className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <RevealOnScroll variant="fade-up" className="order-1">
          <div className="overflow-hidden rounded-[10px] shadow-brand-soft">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={title}
              className="aspect-[600/413] w-full object-cover"
            />
          </div>
        </RevealOnScroll>
        <RevealOnScroll variant="fade-up" delay={0.1} className="order-2">
          <h2 className="font-heading text-[1.75rem] font-bold leading-snug text-[#181818] sm:text-3xl lg:text-[2.35rem]">
            <LifeAtHeading title={title} />
          </h2>
          <SectionSwoosh className="mx-0 mt-2.5" />
          {body ? (
            <p className="mt-4 max-w-lg font-body text-[15px] leading-relaxed text-brand-body sm:text-base">
              {body}
            </p>
          ) : null}
          <Link
            href="/gallery"
            className="sl-hero-btn sl-hero-btn--yellow sl-enroll-cta group mt-8 inline-flex !h-[50px] !min-h-[48px] !px-7 !text-[15px]"
          >
            View more moments
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
          </Link>
        </RevealOnScroll>
      </SectionContainer>
    </section>
  );
}
