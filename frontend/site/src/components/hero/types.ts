import type { LucideIcon } from "lucide-react";
import { GraduationCap, MonitorPlay } from "lucide-react";
import { HERO_IMAGES } from "@/components/brand/hero-images";

/** Hero accent colors for the programming layout */
export const HERO_COLORS = {
  ink: "#181818",
  /** “Programming Skill” + soft ring — brand navy */
  coral: "#1B3A6B",
  /** Zigzag accent */
  teal: "#1B3A6B",
  orange: "#1B3A6B",
  body: "#181818",
  band: "#F0F4F5",
  purple: "#1B3A6B",
} as const;

export type HeroColors = typeof HERO_COLORS;

export type HeroTitlePart = {
  text: string;
  accent?: boolean;
  breakAfter?: boolean;
};

export type HeroStatItem = {
  id: string;
  value: string;
  label: string;
  icon: LucideIcon;
  iconColor?: string;
};

export type HeroFloatItem = {
  id: string;
  src: string;
  alt?: string;
  className: string;
  delay?: number;
  distance?: number;
  duration?: number;
  depth?: number;
  inFront?: boolean;
};

export type HeroDotItem = {
  id: string;
  color: string;
  className: string;
  size?: number;
};

export type ProgrammingHeroProps = {
  titleParts?: HeroTitlePart[];
  subtitle?: string;
  ctaLabel?: string;
  ctaHref?: string;
  imageSrc?: string;
  imageAlt?: string;
  imageWidth?: number;
  imageHeight?: number;
  waveBgSrc?: string;
  zigzagSrc?: string;
  stats?: HeroStatItem[];
  floatItems?: HeroFloatItem[];
  dots?: HeroDotItem[];
  colors?: Partial<HeroColors>;
  showZigzag?: boolean;
  showRing?: boolean;
  showAccentRing?: boolean;
  className?: string;
};

export const DEFAULT_HERO_TITLE: HeroTitlePart[] = [
  { text: "ShikshaLab" },
];

export const DEFAULT_HERO_SUBTITLE = "";

/**
 * Float placement — badges sit on silhouette edges, not across the torso.
 */
export const DEFAULT_HERO_FLOATS: HeroFloatItem[] = [
  {
    id: "html",
    src: HERO_IMAGES.htmlIcon,
    alt: "HTML",
    className:
      "left-[2%] top-[4%] w-[64px] sm:left-[6%] sm:top-[10%] sm:w-[88px] lg:w-[100px]",
    delay: 0.1,
    distance: 14,
    duration: 3.6,
    depth: 0.55,
    inFront: true,
  },
  {
    id: "python",
    src: HERO_IMAGES.pythonIcon,
    alt: "Python",
    className:
      "right-1 top-[50%] w-[72px] sm:right-0 sm:top-[55%] sm:w-[100px] lg:right-[-2%] lg:w-[112px]",
    delay: 0.45,
    distance: 12,
    duration: 4.2,
    depth: 0.4,
    inFront: true,
  },
  {
    id: "code",
    src: HERO_IMAGES.codeIcon,
    alt: "Code",
    className:
      "left-[4%] top-[40%] w-[56px] sm:left-[10%] sm:top-[44%] sm:w-[72px] lg:w-[84px]",
    delay: 0.75,
    distance: 12,
    duration: 3.8,
    depth: 0.5,
    inFront: true,
  },
];

export const DEFAULT_HERO_DOTS: HeroDotItem[] = [
  {
    id: "d1",
    color: "rgba(27,58,107,0.45)",
    className: "right-[6%] top-[4%] hidden sm:block",
    size: 110,
  },
  {
    id: "d2",
    color: "rgba(27,58,107,0.45)",
    className: "bottom-[6%] left-[28%] hidden sm:block",
    size: 90,
  },
];

export function buildDefaultStats(courseCount: number): HeroStatItem[] {
  const stats: HeroStatItem[] = [
    {
      id: "courses",
      value: Math.max(courseCount, 0).toLocaleString("en-US"),
      label: "Online Courses",
      icon: MonitorPlay,
      iconColor: HERO_COLORS.purple,
    },
  ];
  if (courseCount > 0) {
    stats.push({
      id: "programs",
      value: "Live",
      label: "Classes",
      icon: GraduationCap,
      iconColor: HERO_COLORS.coral,
    });
  }
  return stats;
}
