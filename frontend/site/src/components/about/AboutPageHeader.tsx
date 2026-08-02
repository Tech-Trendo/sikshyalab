"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import RevealOnScroll from "@/components/motion/RevealOnScroll";

type Props = {
  title?: string;
  backgroundImage?: string;
};

export function AboutPageHeader({
  title = "About ShikshaLab",
  backgroundImage = "",
}: Props) {
  return (
    <section className="relative w-full overflow-hidden bg-[#0a0a0a]">
      <div className="relative flex min-h-[320px] w-full items-center justify-center overflow-hidden pt-[var(--site-header-height,8.5rem)] sm:min-h-[420px] lg:min-h-[539px]">
        {backgroundImage ? (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url('${backgroundImage}')` }}
            aria-hidden
          />
        ) : null}
        {/* Neutral darken only — no blue tint — keeps white text readable */}
        <div
          className="absolute inset-0 bg-black/45"
          aria-hidden
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/25"
          aria-hidden
        />

        <RevealOnScroll
          variant="fade-up"
          className="relative z-[1] px-4 text-center sm:px-6"
        >
          <h1
            className="font-heading text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-[2.75rem]"
            style={{ textShadow: "0 2px 18px rgba(0,0,0,0.55)" }}
          >
            {title}
          </h1>
          <nav
            aria-label="Breadcrumb"
            className="mt-5 flex flex-wrap items-center justify-center gap-1.5 text-sm text-white/90"
            style={{ textShadow: "0 1px 10px rgba(0,0,0,0.5)" }}
          >
            <Link href="/" className="transition-colors hover:text-brand-orange">
              Home
            </Link>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            <span className="text-white">About Us</span>
          </nav>
        </RevealOnScroll>
      </div>
    </section>
  );
}
