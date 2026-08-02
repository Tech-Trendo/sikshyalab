"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Site entrance timing
 * Duration 1.25s · Ease cubic-bezier(0.215, 0.61, 0.355, 1) · Offset 48px
 */
export const REVEAL_DURATION = 1.25;
export const REVEAL_EASE = [0.215, 0.61, 0.355, 1] as const;
export const REVEAL_OFFSET = 48;
export const STAGGER_STEP = 0.15;

/** Elementor `_animation_delay` values (seconds) from Programming demo */
export const THEME_DELAY = {
  short: 0.1,
  heading: 0.15,
  slideRight: 0.12,
  body: 0.15,
  cta: 0.4,
  media: 0.5,
  decor: 1.0,
} as const;

export const THEME_DURATION = REVEAL_DURATION;
export const THEME_EASE = REVEAL_EASE;
export const THEME_OFFSET = REVEAL_OFFSET;

export type RevealVariant =
  | "fade-up"
  | "fade-in"
  | "slide-left"
  | "slide-right"
  | "slide-down";

const VARIANTS = {
  "fade-up": {
    hidden: { opacity: 0, y: REVEAL_OFFSET },
    visible: { opacity: 1, y: 0 },
  },
  "fade-in": {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  },
  "slide-left": {
    hidden: { opacity: 0, x: REVEAL_OFFSET },
    visible: { opacity: 1, x: 0 },
  },
  "slide-right": {
    hidden: { opacity: 0, x: -REVEAL_OFFSET },
    visible: { opacity: 1, x: 0 },
  },
  "slide-down": {
    hidden: { opacity: 0, y: -REVEAL_OFFSET },
    visible: { opacity: 1, y: 0 },
  },
} as const;

type RevealOnScrollProps = Omit<HTMLMotionProps<"div">, "children"> & {
  children: ReactNode;
  delay?: number;
  duration?: number;
  variant?: RevealVariant;
  className?: string;
};

/**
 * Site-wide scroll reveal — matches Site entrance animations.
 * @example <RevealOnScroll variant="fade-up" delay={THEME_DELAY.body}>…</RevealOnScroll>
 */
export default function RevealOnScroll({
  children,
  delay = 0,
  duration = REVEAL_DURATION,
  variant = "fade-up",
  className,
  ...props
}: RevealOnScrollProps) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      variants={VARIANTS[variant]}
      transition={{ duration, delay, ease: REVEAL_EASE }}
      className={cn(className)}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function RevealStagger({
  children,
  className,
  stagger = STAGGER_STEP,
  delayChildren = 0,
}: {
  children: ReactNode;
  className?: string;
  stagger?: number;
  delayChildren?: number;
}) {
  return (
    <motion.div
      className={cn(className)}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.15 }}
      variants={{
        hidden: {},
        visible: {
          transition: { staggerChildren: stagger, delayChildren },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

export const staggerItem = {
  hidden: { opacity: 0, y: REVEAL_OFFSET },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: REVEAL_DURATION, ease: REVEAL_EASE },
  },
};

export const staggerFadeIn = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: REVEAL_DURATION, ease: REVEAL_EASE },
  },
};
