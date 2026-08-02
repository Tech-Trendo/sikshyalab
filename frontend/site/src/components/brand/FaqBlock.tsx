"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { type FaqItem } from "@/lib/data";
import { cn } from "@/lib/utils";
import { SectionContainer, SectionEyebrow, SectionSwoosh } from "@/components/brand/Section";
import RevealOnScroll, { THEME_DELAY } from "@/components/motion/RevealOnScroll";

type FaqBlockProps = {
  showTabs?: boolean;
  eyebrow?: string;
  title?: string;
  description?: string;
  items?: FaqItem[];
  faqGroups?: Record<string, FaqItem[]>;
  tabs?: string[];
  className?: string;
  /** Partner logo strip under the FAQ (real CMS partners only) */
  showLogos?: boolean;
  partnerLogos?: { id: string | number; logo: string; name?: string }[];
};

/** Accent for FAQ text tabs — brand navy; bell stays orange */
const ACCENT = "#1B3A6B";
const ACCENT_SOFT = "#EAF0F6";

function BellDecor() {
  return (
    <div className="faq-bell-decor pointer-events-none absolute -right-1 -top-4 z-[3] hidden h-[72px] w-[72px] sm:block sm:right-2 sm:top-0 lg:-right-4 lg:-top-2">
      <svg viewBox="0 0 64 64" fill="none" className="h-full w-full drop-shadow-md" aria-hidden>
        <path
          d="M32 8c-9 0-15 7-15 16v10l-5 8h40l-5-8V24c0-9-6-16-15-16z"
          fill="#F8B81F"
        />
        <path d="M32 8c-9 0-15 7-15 16v10l-5 8h40l-5-8V24c0-9-6-16-15-16z" fill="#F5A623" opacity="0.35" />
        <circle cx="32" cy="8" r="4" fill="#E0941B" />
        <path d="M26 52a6 6 0 0012 0z" fill="#E0941B" />
      </svg>
      <span className="absolute -right-1 -top-1 flex h-[26px] w-[26px] items-center justify-center rounded-full bg-[#EF5464] font-heading text-xs font-bold text-white shadow-md">
        1
      </span>
    </div>
  );
}

function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [openIndex, setOpenIndex] = useState(0);
  const visible = items.slice(0, 5);

  return (
    <div className="relative z-[2] flex flex-1 flex-col gap-4">
      <BellDecor />
      {visible.map((item, i) => {
        const open = openIndex === i;
        return (
          <div
            key={item.q}
            className="overflow-hidden rounded-[10px] bg-white shadow-brand-soft"
          >
            <button
              type="button"
              className="flex w-full cursor-pointer items-center justify-between gap-4 px-6 py-5 text-left sm:px-7 sm:py-6"
              onClick={() => setOpenIndex(open ? -1 : i)}
              aria-expanded={open}
            >
              <h3 className="font-heading text-[1.05rem] font-semibold leading-snug text-heading">
                {item.q}
              </h3>
              <ChevronDown
                className={cn(
                  "h-[18px] w-[18px] shrink-0 text-brand-body transition-transform duration-300",
                  open && "rotate-180 text-heading",
                )}
                aria-hidden
              />
            </button>
            <AnimatePresence initial={false}>
              {open && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <p className="px-6 pb-6 font-body text-[15px] leading-[1.75] text-brand-body sm:px-7">
                    {item.a}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

function PartnerLogoStrip({
  logos,
}: {
  logos: { id: string | number; logo: string; name?: string }[];
}) {
  if (!logos.length) return null;
  return (
    <div className="border-t border-brand-border bg-white">
      <SectionContainer className="py-8 lg:py-10">
        <ul className="grid grid-cols-2 items-stretch sm:grid-cols-3 lg:grid-cols-6">
          {logos.map((item, i) => (
            <li
              key={String(item.id)}
              className={cn(
                "flex h-20 items-center justify-center px-4 sm:h-24",
                i > 0 && "lg:border-l lg:border-brand-border",
                i % 2 === 1 && "border-l border-brand-border sm:border-l-0 lg:border-l",
                i % 3 !== 0 && "sm:border-l sm:border-brand-border lg:border-l",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.logo}
                alt={item.name || ""}
                className="h-full w-auto max-w-full object-contain opacity-80"
              />
            </li>
          ))}
        </ul>
      </SectionContainer>
    </div>
  );
}

export function FaqBlock({
  showTabs = true,
  eyebrow = "FAQ'S",
  title = "Learn Your Best Education Culture with ShikshaLab",
  description = "Answers to common questions about learning at ShikshaLab.",
  items,
  faqGroups,
  tabs: tabsProp,
  className,
  showLogos = false,
  partnerLogos = [],
}: FaqBlockProps) {
  const groups: Record<string, FaqItem[]> = (faqGroups as Record<string, FaqItem[]>) ?? {};
  const tabList = tabsProp?.length
    ? tabsProp
    : Object.keys(groups);
  const [tab, setTab] = useState(tabList[0] ?? "");
  const allItems = items ?? Object.values(groups).flat();
  const list = showTabs ? (items ?? groups[tab] ?? groups[tabList[0]] ?? []) : allItems;

  if (!allItems.length && !list.length) return null;

  const titleNode = title.includes("Education Culture") ? (
    <>
      Learn Your Best Education
      <br className="hidden sm:block" /> Culture with ShikshaLab
    </>
  ) : (
    title
  );

  return (
    <>
      <section className={cn("relative overflow-hidden bg-white py-16 lg:py-20", className)}>
        <div
          className="pointer-events-none absolute bottom-8 left-4 z-0 hidden h-[140px] w-[140px] opacity-60 md:block lg:left-10"
          style={{
            backgroundImage: "radial-gradient(#D1D5DB 1.5px, transparent 1.5px)",
            backgroundSize: "14px 14px",
          }}
          aria-hidden
        />

        <SectionContainer className="relative z-[1] grid items-start gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.25fr)] lg:gap-16">
          {/* Left */}
          <RevealOnScroll variant="slide-right" delay={THEME_DELAY.slideRight} className="relative max-w-md">
            <SectionEyebrow align="left" className="mb-3">
              {eyebrow}
            </SectionEyebrow>
            <h2 className="font-heading text-[1.85rem] font-bold leading-[1.3] tracking-tight text-heading sm:text-[2.15rem]">
              {titleNode}
            </h2>
            <SectionSwoosh className="mx-0 mt-3 mb-5" />
            <p className="mb-8 max-w-[340px] font-body text-[15px] leading-[1.75] text-[#181818]">
              {description}
            </p>

            {showTabs && (
              <div className="flex flex-col gap-2" role="tablist" aria-label="FAQ categories">
                {tabList.map((t) => {
                  const active = tab === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setTab(t)}
                      className={cn(
                        "w-fit rounded-[8px] px-5 py-3.5 text-left font-heading text-[15px] font-medium transition-colors duration-200",
                        active
                          ? "font-semibold"
                          : "bg-transparent text-heading hover:bg-brand-shade",
                      )}
                      style={
                        active
                          ? { backgroundColor: ACCENT_SOFT, color: ACCENT }
                          : undefined
                      }
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            )}
          </RevealOnScroll>

          {/* Right */}
          <RevealOnScroll variant="slide-left" delay={THEME_DELAY.media} className="relative min-w-0 pt-2 lg:pt-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={showTabs ? tab : "all"}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
              >
                <FaqAccordion items={list} />
              </motion.div>
            </AnimatePresence>
          </RevealOnScroll>
        </SectionContainer>
      </section>

      {showLogos ? <PartnerLogoStrip logos={partnerLogos} /> : null}
    </>
  );
}
