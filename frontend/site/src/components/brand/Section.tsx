"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import RevealOnScroll, { REVEAL_DURATION, THEME_DELAY } from "@/components/motion/RevealOnScroll";
import { SectionEyebrow } from "@/components/brand/SectionEyebrow";

/**
 * Section rhythm: 64px mobile / 120px desktop.
 * Full-bleed section shell — put decorations/blobs here.
 * Wrap body copy in `<SectionContainer>` (same width as header/footer).
 */
type SectionProps = React.ComponentProps<"section"> & {
  children: ReactNode;
  muted?: boolean;
  blobs?: boolean;
};

export function Section({ children, className, muted, blobs, ...props }: SectionProps) {
  return (
    <section
      className={cn(
        "sl-section relative overflow-hidden",
        muted ? "bg-hero-band" : "bg-white",
        className,
      )}
      {...props}
    >
      {blobs && (
        <>
          <span
            className="pointer-events-none absolute -left-24 top-8 z-0 h-40 w-40 rounded-full bg-brand-orange/10"
            aria-hidden
          />
          <span
            className="pointer-events-none absolute -right-20 bottom-8 z-0 h-32 w-32 rounded-full bg-brand-navy/10"
            aria-hidden
          />
        </>
      )}
      <div className="relative z-[1]">{children}</div>
    </section>
  );
}

/** Shared site content width — matches Header / Footer. */
export const SITE_CONTAINER_CLASS =
  "relative mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8";

/** Shared site content width — matches Header / Footer (`max-w-[1200px] px-4 sm:px-6 lg:px-8`). */
export function SectionContainer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn(SITE_CONTAINER_CLASS, className)}>{children}</div>;
}

export { SectionEyebrow } from "@/components/brand/SectionEyebrow";

/** theme title-shape brush (icon-19) — brand orange */
export function SectionSwoosh({ className }: { className?: string }) {
  return (
    <span className={cn("sl-title-shape", className)} aria-hidden>
      <i className="sl-icon-19" />
    </span>
  );
}

type SectionHeadingProps = {
  eyebrow?: string;
  /** Preferred prop name for section title */
  heading?: ReactNode;
  /** Alias used across existing call sites */
  title?: ReactNode;
  description?: string;
  align?: "left" | "center";
  className?: string;
  dark?: boolean;
  showSwoosh?: boolean;
};

/**
 * Reusable section header: label + Spartan heading + brush title-shape.
 * Prefer `<SectionHeader eyebrow="…" heading="…" />` — `SectionHeading` kept for compatibility.
 */
export function SectionHeader({
  eyebrow,
  heading,
  title,
  description,
  align = "center",
  className,
  dark,
  showSwoosh = true,
}: SectionHeadingProps) {
  const centered = align === "center";
  const label = heading ?? title;

  return (
    <RevealOnScroll
      variant="fade-up"
      delay={0}
      duration={REVEAL_DURATION}
      className={cn(centered && "text-center", className)}
    >
      {eyebrow && (
        <SectionEyebrow align={centered ? "center" : "left"}>{eyebrow}</SectionEyebrow>
      )}
      {label != null && (
        <h2
          className={cn(
            "sl-section-title",
            dark && "text-white",
            centered && "mx-auto max-w-3xl",
          )}
        >
          {label}
        </h2>
      )}
      {showSwoosh && !dark && (
        <SectionSwoosh className={cn(!centered && "mx-0")} />
      )}
      {description && (
        <p
          className={cn(
            "sl-section-desc",
            dark ? "text-white/70" : undefined,
            centered ? "mx-auto max-w-2xl" : "max-w-xl",
          )}
        >
          {description}
        </p>
      )}
    </RevealOnScroll>
  );
}

/** @deprecated Prefer SectionHeader — same API with `title` alias */
export function SectionHeading(props: SectionHeadingProps) {
  return <SectionHeader {...props} />;
}

export function RevealLeft({
  children,
  className,
  delay = THEME_DELAY.media,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <RevealOnScroll variant="slide-left" delay={delay} duration={REVEAL_DURATION} className={className}>
      {children}
    </RevealOnScroll>
  );
}

export function RevealRight({
  children,
  className,
  delay = THEME_DELAY.media,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <RevealOnScroll variant="slide-right" delay={delay} duration={REVEAL_DURATION} className={className}>
      {children}
    </RevealOnScroll>
  );
}

export function RevealFadeUp({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <RevealOnScroll variant="fade-up" delay={delay} duration={REVEAL_DURATION} className={className}>
      {children}
    </RevealOnScroll>
  );
}
