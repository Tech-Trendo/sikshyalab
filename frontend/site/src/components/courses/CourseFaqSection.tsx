"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SectionContainer } from "@/components/brand/Section";
import { cn } from "@/lib/utils";

export type CourseFaqItem = {
  id?: string;
  question: string;
  answer: string;
  order?: number;
};

function FaqTriangle({ open }: { open: boolean }) {
  return (
    <span
      className="mt-0.5 inline-block w-4 shrink-0 text-center text-[11px] leading-none text-[#181818]"
      aria-hidden
    >
      {open ? "▼" : "▶"}
    </span>
  );
}

export function CourseFaqSection({ faqs }: { faqs?: CourseFaqItem[] }) {
  const items = (faqs ?? [])
    .filter((f) => f.question.trim() && f.answer.trim())
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const [openIndex, setOpenIndex] = useState(0);

  if (!items.length) return null;

  return (
    <section className="bg-brand-lighten-02 py-12 lg:py-16" aria-labelledby="course-faq-heading">
      <SectionContainer className="mx-auto max-w-3xl">
        <h2
          id="course-faq-heading"
          className="text-center font-secondary text-xl font-bold text-[#181818] sm:text-2xl"
        >
          Frequently Asked Questions
        </h2>
        <div className="mt-4 border-b border-black/10" aria-hidden />

        <div className="mt-0">
          {items.map((item, i) => {
            const open = openIndex === i;
            return (
              <div key={item.id || `${item.question}-${i}`} className="border-b border-black/10">
                <button
                  type="button"
                  className="flex w-full items-start gap-3 py-4 text-left sm:gap-3.5 sm:py-5"
                  onClick={() => setOpenIndex(open ? -1 : i)}
                  aria-expanded={open}
                >
                  <FaqTriangle open={open} />
                  <span className="min-w-0 flex-1 font-bold text-[#181818] sm:text-[15px]">
                    {item.question}
                  </span>
                </button>
                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <p
                        className={cn(
                          "pb-4 pl-7 text-sm leading-relaxed text-brand-body sm:pl-7 sm:text-[15px]",
                        )}
                      >
                        {item.answer}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </SectionContainer>
    </section>
  );
}
