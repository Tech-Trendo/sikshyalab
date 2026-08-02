"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { Header, HEADER_OFFSET } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { BackToTop } from "@/components/motion/BackToTop";
import { SectionContainer } from "@/components/brand/Section";
import RevealOnScroll, { THEME_DELAY } from "@/components/motion/RevealOnScroll";
import { cn } from "@/lib/utils";

/**
 * Site chrome: header/footer share `SectionContainer` width
 * (`max-w-[1200px] px-4 sm:px-6 lg:px-8`). Page body content should use the
 * same container; decorative animations/blobs stay outside it (full-bleed).
 *
 * Pages that start with `PageHero` (or a full-bleed banner) should use
 * `flushTop` so there is no white gap under the fixed navbar.
 */
export function SiteLayout({
  children,
  flushTop = false,
}: {
  children: React.ReactNode;
  flushTop?: boolean;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-white font-body text-brand-navy-dark">
      <Header />
      <main className={cn("flex-1", !flushTop && HEADER_OFFSET)}>{children}</main>
      <Footer />
      <BackToTop />
    </div>
  );
}

export function PageHero({
  title,
  subtitle,
  eyebrow,
  className,
  flushHeader = true,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  className?: string;
  /** Banner sits flush under the fixed navbar (no white gap). Pair with `SiteLayout flushTop`. */
  flushHeader?: boolean;
}) {
  const path = usePathname() || "/";
  const crumb = path
    .split("/")
    .filter(Boolean)
    .map((s) => s.replace(/-/g, " "))
    .map((s) => s.replace(/\b\w/g, (c) => c.toUpperCase()));

  return (
    <section className={cn("relative overflow-hidden bg-brand-navy", className)}>
      <span
        className="pointer-events-none absolute -left-20 top-0 h-56 w-56 rounded-full bg-brand-orange/10"
        aria-hidden
      />
      <span
        className="pointer-events-none absolute -right-16 bottom-0 h-48 w-48 rounded-full bg-white/10"
        aria-hidden
      />
      <SectionContainer
        className={cn(
          "relative z-[1] pb-14 text-center md:pb-20",
          flushHeader
            ? "pt-[calc(var(--site-header-height,8.5rem)+1.75rem)] sm:pt-[calc(var(--site-header-height,9rem)+2.25rem)] md:pt-[calc(var(--site-header-height,9rem)+2.75rem)]"
            : "pt-16 md:pt-24",
        )}
      >
        <RevealOnScroll variant="fade-up" delay={THEME_DELAY.heading}>
          {eyebrow && (
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.14em] text-brand-orange">
              {eyebrow}
            </p>
          )}
          <h1 className="break-words font-secondary text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-[2.75rem]">
            {title}
          </h1>
          {subtitle && (
            <p className="mx-auto mt-3 max-w-2xl break-words text-[15px] leading-relaxed text-white/70 line-clamp-4 sm:line-clamp-none">
              {subtitle}
            </p>
          )}
          <nav className="mt-6 flex flex-wrap items-center justify-center gap-1.5 text-sm text-white/65">
            <Link
              href="/"
              className="transition-colors duration-brand ease-in-out hover:text-white"
            >
              Home
            </Link>
            {crumb.map((c) => (
              <span key={c} className="inline-flex items-center gap-1.5">
                <ChevronRight className="h-3.5 w-3.5" />
                <span className="text-white">{c}</span>
              </span>
            ))}
          </nav>
        </RevealOnScroll>
      </SectionContainer>
    </section>
  );
}
