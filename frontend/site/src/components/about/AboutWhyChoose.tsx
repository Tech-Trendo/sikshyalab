"use client";

import { GraduationCap, KeyRound, Presentation } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { SectionContainer, SectionSwoosh } from "@/components/brand/Section";
import { SectionEyebrow } from "@/components/brand/SectionEyebrow";
import RevealOnScroll, {
  REVEAL_DURATION,
  RevealStagger,
  staggerItem,
} from "@/components/motion/RevealOnScroll";

const CARDS = [
  {
    title: "High Quality Courses",
    body: "Project-based programs designed to help you build real skills and career-ready portfolios.",
    Icon: GraduationCap,
    iconColor: "#1B3A6B",
    iconBg: "rgba(27, 58, 107, 0.12)",
  },
  {
    title: "Life Time Access",
    body: "Learn at your pace with lasting access to course materials, updates, and community support.",
    Icon: KeyRound,
    iconColor: "#F5A623",
    iconBg: "rgba(245, 166, 35, 0.16)",
  },
  {
    title: "Expert Instructors",
    body: "Learn from industry mentors who guide you through practical projects and career growth.",
    Icon: Presentation,
    iconColor: "#142C52",
    iconBg: "rgba(20, 44, 82, 0.12)",
  },
] as const;

const floatTransition = (duration: number, delay = 0) => ({
  duration,
  delay,
  repeat: Infinity,
  repeatType: "mirror" as const,
  ease: "easeInOut" as const,
});

function DottedCircle({
  className,
  color,
  size = 110,
  reduceMotion,
}: {
  className?: string;
  color: string;
  size?: number;
  reduceMotion?: boolean;
}) {
  const rings = [
    { r: 0.18, count: 6 },
    { r: 0.32, count: 10 },
    { r: 0.46, count: 14 },
  ];
  const cx = size / 2;
  const cy = size / 2;
  const dots: { x: number; y: number; i: number }[] = [];
  let i = 0;
  for (const ring of rings) {
    for (let n = 0; n < ring.count; n++) {
      const a = (n / ring.count) * Math.PI * 2 - Math.PI / 2;
      dots.push({
        x: cx + Math.cos(a) * ring.r * size,
        y: cy + Math.sin(a) * ring.r * size,
        i: i++,
      });
    }
  }

  return (
    <motion.div
      className={className}
      style={{ width: size, height: size }}
      animate={reduceMotion ? undefined : { y: [0, -10, 0], rotate: [0, 8, 0] }}
      transition={floatTransition(6)}
      aria-hidden
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none">
        {dots.map((d) => (
          <motion.circle
            key={d.i}
            cx={d.x}
            cy={d.y}
            r={3}
            fill={color}
            initial={{ opacity: 0.45 }}
            animate={reduceMotion ? { opacity: 0.55 } : { opacity: [0.35, 0.75, 0.35] }}
            transition={floatTransition(2.8, d.i * 0.08)}
          />
        ))}
      </svg>
    </motion.div>
  );
}

function DottedGrid({
  className,
  color,
  cols = 5,
  rows = 4,
  reduceMotion,
}: {
  className?: string;
  color: string;
  cols?: number;
  rows?: number;
  reduceMotion?: boolean;
}) {
  return (
    <motion.div
      className={className}
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, 6px)`,
        gap: "8px",
      }}
      animate={reduceMotion ? undefined : { y: [0, 8, 0], x: [0, -4, 0] }}
      transition={floatTransition(5, 0.4)}
      aria-hidden
    >
      {Array.from({ length: cols * rows }).map((_, i) => (
        <motion.span
          key={i}
          className="h-[5px] w-[5px] rounded-full"
          style={{ backgroundColor: color }}
          animate={
            reduceMotion
              ? { opacity: 0.55 }
              : { opacity: [0.35, 0.8, 0.35], scale: [1, 1.15, 1] }
          }
          transition={floatTransition(2.4, i * 0.06)}
        />
      ))}
    </motion.div>
  );
}

function SoftRing({
  className,
  size,
  borderWidth = 1,
  color = "rgba(27, 58, 107, 0.12)",
  duration = 18,
  reverse = false,
  reduceMotion,
}: {
  className?: string;
  size: number;
  borderWidth?: number;
  color?: string;
  duration?: number;
  reverse?: boolean;
  reduceMotion?: boolean;
}) {
  return (
    <motion.span
      className={className}
      style={{
        width: size,
        height: size,
        borderWidth,
        borderStyle: "solid",
        borderColor: color,
        borderRadius: "9999px",
      }}
      animate={
        reduceMotion
          ? undefined
          : {
              rotate: reverse ? [0, -360] : [0, 360],
              scale: [1, 1.04, 1],
            }
      }
      transition={{
        rotate: { duration, repeat: Infinity, ease: "linear" },
        scale: floatTransition(5),
      }}
      aria-hidden
    />
  );
}

/** Why choose — white bg, site typography, animated ornaments. */
export function AboutWhyChoose({
  items,
}: {
  items?: Array<{ title: string; description?: string; body?: string; icon?: string }>;
}) {
  const reduceMotion = useReducedMotion() ?? false;
  const cmsCards = (items || [])
    .map((item) => ({
      title: item.title.trim(),
      body: String(item.description || item.body || "").trim(),
      icon: item.icon?.trim() || "",
    }))
    .filter((item) => item.title || item.body);
  const cards = cmsCards.length
    ? cmsCards.map((item, i) => ({
        ...item,
        Icon: CARDS[i % CARDS.length].Icon,
        iconColor: CARDS[i % CARDS.length].iconColor,
        iconBg: CARDS[i % CARDS.length].iconBg,
      }))
    : CARDS.map((c) => ({
        title: c.title,
        body: c.body,
        icon: "",
        Icon: c.Icon,
        iconColor: c.iconColor,
        iconBg: c.iconBg,
      }));

  return (
    <section className="sl-section relative overflow-hidden bg-white">
      <DottedCircle
        className="pointer-events-none absolute left-4 top-8 z-0 hidden md:block lg:left-12 lg:top-14"
        color="#1B3A6B"
        size={118}
        reduceMotion={reduceMotion}
      />

      <DottedGrid
        className="pointer-events-none absolute right-6 top-10 z-0 hidden md:block lg:right-20 lg:top-16"
        color="#F5A623"
        cols={5}
        rows={4}
        reduceMotion={reduceMotion}
      />

      <SoftRing
        className="pointer-events-none absolute -bottom-28 right-[8%] z-0 hidden lg:block"
        size={380}
        duration={28}
        reduceMotion={reduceMotion}
      />
      <SoftRing
        className="pointer-events-none absolute -bottom-16 right-[18%] z-0 hidden lg:block"
        size={300}
        duration={22}
        reverse
        color="rgba(27, 58, 107, 0.08)"
        reduceMotion={reduceMotion}
      />

      <motion.span
        className="pointer-events-none absolute bottom-8 right-6 z-0 hidden h-[112px] w-[112px] rounded-full border-[12px] border-brand-orange lg:right-16 lg:block xl:right-24"
        animate={reduceMotion ? undefined : { y: [0, -14, 0], rotate: [0, 12, 0] }}
        transition={floatTransition(4.5, 0.2)}
        aria-hidden
      />

      <motion.span
        className="pointer-events-none absolute left-[42%] top-24 z-0 hidden h-2.5 w-2.5 rounded-full bg-brand-navy/40 lg:block"
        animate={reduceMotion ? undefined : { y: [0, -16, 0], opacity: [0.4, 0.9, 0.4] }}
        transition={floatTransition(3.2)}
        aria-hidden
      />
      <motion.span
        className="pointer-events-none absolute bottom-28 left-[12%] z-0 hidden h-3 w-3 rounded-full bg-brand-orange/45 lg:block"
        animate={reduceMotion ? undefined : { y: [0, 12, 0], x: [0, 8, 0] }}
        transition={floatTransition(4)}
        aria-hidden
      />

      <SectionContainer className="relative z-[1]">
        <RevealOnScroll
          variant="fade-up"
          delay={0}
          duration={REVEAL_DURATION}
          className="sl-section-head text-center"
        >
          <SectionEyebrow align="center" className="mb-2.5">
            Why Choose ShikshaLab
          </SectionEyebrow>
          <h2 className="sl-section-title mx-auto max-w-3xl">
            <span className="text-[#181818]">The Best</span>{" "}
            <span className="text-brand-navy">Beneficial</span>{" "}
            <span className="text-[#181818]">Side</span>
            <br />
            <span className="text-[#181818]">of ShikshaLab</span>
          </h2>
          <SectionSwoosh className="mx-auto mt-2" />
        </RevealOnScroll>

        <RevealStagger className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
          {cards.map((box) => (
            <motion.article
              key={box.title}
              variants={staggerItem}
              whileHover={reduceMotion ? undefined : { y: -8 }}
              transition={{ duration: 0.28, ease: [0.215, 0.61, 0.355, 1] }}
              className="rounded-[10px] border border-brand-border/70 bg-white px-7 py-10 text-center shadow-brand-soft sm:px-8 sm:py-11"
            >
              {box.icon ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={box.icon}
                  alt=""
                  className="mx-auto mb-6 h-[80px] w-[80px] rounded-full object-cover"
                />
              ) : (
                <motion.span
                  className="mx-auto mb-6 grid h-[80px] w-[80px] place-items-center rounded-full"
                  style={{ backgroundColor: box.iconBg, color: box.iconColor }}
                  whileHover={reduceMotion ? undefined : { scale: 1.08, rotate: -4 }}
                  transition={{ type: "spring", stiffness: 260, damping: 18 }}
                >
                  <box.Icon className="h-9 w-9" strokeWidth={1.6} />
                </motion.span>
              )}
              <h3 className="font-secondary text-lg font-bold text-brand-navy-dark sm:text-xl">
                {box.title}
              </h3>
              <p className="mt-3 text-[15px] leading-relaxed text-brand-body">{box.body}</p>
            </motion.article>
          ))}
        </RevealStagger>
      </SectionContainer>
    </section>
  );
}
