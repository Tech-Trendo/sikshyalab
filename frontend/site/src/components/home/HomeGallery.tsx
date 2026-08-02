"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { Section, SectionContainer, SectionHeading } from "@/components/brand/Section";
import RevealOnScroll, {
  THEME_DELAY,
  RevealStagger,
  staggerItem,
} from "@/components/motion/RevealOnScroll";
import { usePublicData } from "@/hooks/usePublicData";

/** Home gallery — newest 6 photos (16:9 cards, same size as event cards). */
export function HomeGallery() {
  const { gallery, loading } = usePublicData();
  const list = gallery.slice(0, 6);

  if (!loading && list.length === 0) return null;

  return (
    <Section muted>
      <SectionContainer>
        <SectionHeading
          align="center"
          eyebrow="Gallery"
          heading="Life at ShikshaLab"
          className="sl-section-head"
        />

        <RevealStagger className="grid justify-items-stretch gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
          {list.map((g) => (
            <motion.figure
              key={String(g.id)}
              variants={staggerItem}
              className="group w-full overflow-hidden rounded-[10px] border border-brand-border/70 bg-white shadow-brand-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-brand-med"
            >
              <div className="relative aspect-[16/9] w-full overflow-hidden bg-[#E8EEF6]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={g.image}
                  alt={g.title || "Campus life"}
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
            </motion.figure>
          ))}
        </RevealStagger>

        <RevealOnScroll variant="fade-up" delay={THEME_DELAY.media} className="mt-8 text-center">
          <Link
            href="/gallery"
            className="sl-view-more-btn group inline-flex w-full max-w-xs sm:w-auto"
          >
            View more
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        </RevealOnScroll>
      </SectionContainer>
    </Section>
  );
}
