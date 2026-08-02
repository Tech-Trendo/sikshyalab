"use client";

import { BookOpenCheck, GraduationCap, Smile, Users } from "lucide-react";
import { motion } from "framer-motion";
import { SectionContainer } from "@/components/brand/Section";
import RevealOnScroll, { RevealStagger, staggerItem } from "@/components/motion/RevealOnScroll";
import { AnimatedCounter } from "@/components/home/AnimatedCounter";
import { usePublicData } from "@/hooks/usePublicData";

const ICONS = [GraduationCap, BookOpenCheck, Smile, Users] as const;

/** 2× brand-med shadow for About stats cards */
const STAT_CARD_SHADOW =
  "0px 24px 72px rgba(27, 58, 107, 0.22), 0px 12px 36px rgba(27, 58, 107, 0.16)";

export function AboutStats() {
  const { stats, loading } = usePublicData();

  if (loading) return null;
  if (!stats.length) return null;

  return (
    <section className="relative overflow-hidden bg-brand-shade py-16 lg:py-[100px]">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.1]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1200' height='600' viewBox='0 0 1200 600'%3E%3Cg fill='%231B3A6B'%3E%3Ccircle cx='80' cy='120' r='2'/%3E%3Ccircle cx='120' cy='100' r='2'/%3E%3Ccircle cx='160' cy='140' r='2'/%3E%3Ccircle cx='200' cy='90' r='2'/%3E%3Ccircle cx='240' cy='130' r='2'/%3E%3Ccircle cx='280' cy='110' r='2'/%3E%3Ccircle cx='320' cy='160' r='2'/%3E%3Ccircle cx='380' cy='100' r='2'/%3E%3Ccircle cx='420' cy='140' r='2'/%3E%3Ccircle cx='460' cy='80' r='2'/%3E%3Ccircle cx='520' cy='120' r='2'/%3E%3Ccircle cx='580' cy='90' r='2'/%3E%3Ccircle cx='640' cy='150' r='2'/%3E%3Ccircle cx='700' cy='110' r='2'/%3E%3Ccircle cx='760' cy='130' r='2'/%3E%3Ccircle cx='820' cy='90' r='2'/%3E%3Ccircle cx='880' cy='140' r='2'/%3E%3Ccircle cx='940' cy='100' r='2'/%3E%3Ccircle cx='1000' cy='160' r='2'/%3E%3Ccircle cx='1060' cy='120' r='2'/%3E%3C/g%3E%3C/svg%3E")`,
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          backgroundSize: "cover",
        }}
        aria-hidden
      />

      <SectionContainer className="relative z-[1]">
        <RevealStagger
          className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-7"
          stagger={0.08}
        >
          {stats.map((stat, i) => {
            const Icon = ICONS[i % ICONS.length];
            return (
              <motion.article
                key={stat.id}
                variants={staggerItem}
                className="flex flex-col items-center rounded-[10px] bg-white px-6 py-9 text-center sm:py-10"
                style={{ boxShadow: STAT_CARD_SHADOW }}
              >
                <span className="mb-5 grid h-16 w-16 place-items-center rounded-full bg-brand-orange/10 text-brand-orange">
                  <Icon className="h-7 w-7" aria-hidden />
                </span>
                <p className="font-heading text-3xl font-bold text-heading sm:text-4xl">
                  <AnimatedCounter value={stat.value} decimals={0} suffix={stat.suffix || ""} />
                </p>
                <p className="mt-2.5 text-xs font-bold uppercase tracking-[1.5px] text-brand-body">
                  {stat.label}
                </p>
              </motion.article>
            );
          })}
        </RevealStagger>
        <RevealOnScroll variant="fade-in" delay={0.2} className="mt-6 text-center">
          <p className="text-[11px] text-brand-body/70">Live metrics from published courses and batches.</p>
        </RevealOnScroll>
      </SectionContainer>
    </section>
  );
}
