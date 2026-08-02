import type { Transition, Variants } from "framer-motion";

/** Entrance ease + duration */
export const HERO_EASE = [0.215, 0.61, 0.355, 1] as const;
export const HERO_DURATION = 1.25;
export const HERO_OFFSET = 48;

export const heroEntrance = (delay = 0, duration = HERO_DURATION): Transition => ({
  duration,
  delay: delay / 1000,
  ease: HERO_EASE,
});

/** @keyframes sl-slide-up */
export const heroSlideUp: Variants = {
  hidden: { opacity: 0, y: HERO_OFFSET },
  visible: { opacity: 1, y: 0 },
};

/** @keyframes sl-slide-down */
export const heroSlideDown: Variants = {
  hidden: { opacity: 0, y: -HERO_OFFSET },
  visible: { opacity: 1, y: 0 },
};

/** @keyframes sl-slide-right — enters from left */
export const heroSlideRight: Variants = {
  hidden: { opacity: 0, x: -HERO_OFFSET },
  visible: { opacity: 1, x: 0 },
};

/** @keyframes sl-slide-left — enters from right (Programming hero image) */
export const heroSlideLeft: Variants = {
  hidden: { opacity: 0, x: HERO_OFFSET },
  visible: { opacity: 1, x: 0 },
};

/** @keyframes fadeIn */
export const heroFadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

/** delayMs = Elementor `_animation_delay` on Programming demo */
export const heroAnim = (delayMs = 0, duration = HERO_DURATION): Transition => ({
  duration,
  delay: delayMs / 1000,
  ease: HERO_EASE,
});

export function heroFloatAnim(
  delay = 0,
  distance = 20,
  duration = 5,
  rotate = 0,
) {
  return {
    animate: {
      y: [0, -distance, 0],
      ...(rotate ? { rotate: [0, rotate, 0, -rotate, 0] } : {}),
    },
    transition: {
      repeat: Infinity,
      duration,
      ease: "easeInOut" as const,
      delay,
    },
  };
}

export function heroPulseAnim(delay = 0, duration = 6) {
  return {
    animate: {
      scale: [1, 1.08, 1],
      opacity: [0.5, 0.75, 0.5],
    },
    transition: {
      repeat: Infinity,
      duration,
      ease: "easeInOut" as const,
      delay,
    },
  };
}

export function heroWobbleAnim(delay = 0) {
  return {
    animate: {
      rotate: [0, 8, 0, -8, 0],
      scale: [1, 1.05, 1],
    },
    transition: {
      repeat: Infinity,
      duration: 12,
      ease: "easeInOut" as const,
      delay,
    },
  };
}

export const HERO_PARALLAX = {
  bg: 12,
  shape: 22,
  image: 35,
  support: 28,
} as const;
