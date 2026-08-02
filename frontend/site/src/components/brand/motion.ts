import type { Variants, Transition } from "framer-motion";
import {
  THEME_DELAY,
  THEME_DURATION,
  THEME_EASE,
  THEME_OFFSET,
} from "@/lib/theme-motion";

/** Site easing — cubic-bezier(0.215, 0.61, 0.355, 1) */
export const EASE_OUT: Transition["ease"] = THEME_EASE;

export const viewportOnce = { once: true, amount: 0.2, margin: "-40px" } as const;

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: THEME_OFFSET },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: THEME_DURATION, ease: EASE_OUT },
  },
};

export const fadeUpItem: Variants = {
  hidden: { opacity: 0, y: THEME_OFFSET },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: THEME_DURATION, ease: EASE_OUT },
  },
};

/** @keyframes sl-slide-right — enters from left */
export const slideFromLeft: Variants = {
  hidden: { opacity: 0, x: -THEME_OFFSET },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: THEME_DURATION, ease: EASE_OUT },
  },
};

/** @keyframes sl-slide-left — enters from right */
export const slideFromRight: Variants = {
  hidden: { opacity: 0, x: THEME_OFFSET },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: THEME_DURATION, ease: EASE_OUT },
  },
};

export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: THEME_DELAY.heading,
      delayChildren: THEME_DELAY.heading,
    },
  },
};

export const floatY = (distance = 12, duration = 4) => ({
  animate: { y: [0, -distance, 0] },
  transition: { repeat: Infinity, duration, ease: "easeInOut" as const },
});
