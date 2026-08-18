"use client";

import { Compass, Eye, Gem } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { SectionContainer } from "@/components/brand/Section";
import { RevealStagger, staggerItem } from "@/components/motion/RevealOnScroll";
import type { AboutCardItem } from "@/lib/about-cms";

const ICONS = [Compass, Eye, Gem] as const;
const TONES = [
  { iconColor: "#1B3A6B", iconBg: "rgba(27, 58, 107, 0.12)" },
  { iconColor: "#F5A623", iconBg: "rgba(245, 166, 35, 0.16)" },
  { iconColor: "#142C52", iconBg: "rgba(20, 44, 82, 0.12)" },
] as const;

export function AboutPillars({ items }: { items: AboutCardItem[] }) {
  const reduceMotion = useReducedMotion() ?? false;
  const cards = items.filter((item) => item.title.trim() || item.description.trim());
  if (!cards.length) return null;

  return (
    <section className="section-y bg-brand-lighten-02">
      <SectionContainer>
        <RevealStagger className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
          {cards.map((card, i) => {
            const Icon = ICONS[i % ICONS.length];
            const tone = TONES[i % TONES.length];
            return (
              <motion.article
                key={`${card.title}-${i}`}
                variants={staggerItem}
                whileHover={reduceMotion ? undefined : { y: -8 }}
                transition={{ duration: 0.28, ease: [0.215, 0.61, 0.355, 1] }}
                className="rounded-[10px] border border-brand-border/70 bg-white px-7 py-10 text-center shadow-brand-soft sm:px-8 sm:py-11"
              >
                {card.icon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={card.icon}
                    alt=""
                    className="mx-auto mb-6 h-[80px] w-[80px] rounded-full object-cover"
                  />
                ) : (
                  <span
                    className="mx-auto mb-6 grid h-[80px] w-[80px] place-items-center rounded-full"
                    style={{ backgroundColor: tone.iconBg, color: tone.iconColor }}
                  >
                    <Icon className="h-9 w-9" strokeWidth={1.6} />
                  </span>
                )}
                <h3 className="font-secondary text-lg font-bold text-brand-navy-dark sm:text-xl">
                  {card.title}
                </h3>
                {card.description ? (
                  <p className="mt-3 text-[15px] leading-relaxed text-brand-body">{card.description}</p>
                ) : null}
              </motion.article>
            );
          })}
        </RevealStagger>
      </SectionContainer>
    </section>
  );
}
