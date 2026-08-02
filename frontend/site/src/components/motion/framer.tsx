"use client";

import { motion, type HTMLMotionProps, type Variants } from "framer-motion";
import type { ReactNode } from "react";
import {
  fadeUp as brandFadeUp,
  staggerContainer as brandStagger,
  EASE_OUT,
} from "@/components/brand/motion";
import { THEME_DURATION } from "@/lib/theme-motion";

export const fadeUp: Variants = brandFadeUp;
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: THEME_DURATION, ease: EASE_OUT },
  },
};
export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.94 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: THEME_DURATION, ease: EASE_OUT },
  },
};
export const staggerContainer: Variants = brandStagger;

type RevealProps = HTMLMotionProps<"div"> & {
  children: ReactNode;
  delay?: number;
};

export function Reveal({ children, delay = 0, ...props }: RevealProps) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-60px" }}
      variants={fadeUp}
      transition={{ duration: THEME_DURATION, ease: EASE_OUT, delay }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function Stagger({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-40px" }}
      variants={staggerContainer}
    >
      {children}
    </motion.div>
  );
}

export { motion };
