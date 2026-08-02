"use client";

import { SectionContainer } from "@/components/brand/Section";
import RevealOnScroll from "@/components/motion/RevealOnScroll";
import { usePublicData } from "@/hooks/usePublicData";

/** Partner logos from CMS `/cms/partners/` — logos only on the homepage. */
export function PartnersStrip() {
  const { partners } = usePublicData();
  if (!partners.length) return null;

  return (
    <section className="border-y border-brand-border bg-white py-8 lg:py-10">
      <SectionContainer>
        <RevealOnScroll variant="fade-up">
          <ul className="grid grid-cols-2 items-stretch gap-4 sm:grid-cols-3 lg:grid-cols-6 lg:gap-5">
            {partners.map((item) => {
              const inner = (
                <div className="flex h-20 w-full items-center justify-center sm:h-24">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.logo}
                    alt={item.name || ""}
                    className="h-full w-auto max-w-full object-contain opacity-90"
                  />
                </div>
              );
              return (
                <li key={String(item.id)} className="flex min-h-20 items-stretch justify-center sm:min-h-24">
                  {item.website_url ? (
                    <a
                      href={item.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-full w-full max-w-[180px] items-stretch justify-center"
                    >
                      {inner}
                    </a>
                  ) : (
                    <div className="flex h-full w-full max-w-[180px] items-stretch justify-center">
                      {inner}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </RevealOnScroll>
      </SectionContainer>
    </section>
  );
}
