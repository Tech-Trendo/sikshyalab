"use client";

import { useEffect, useRef, useState } from "react";
import CountUp from "react-countup";
import { useInView } from "framer-motion";
import RevealOnScroll from "@/components/motion/RevealOnScroll";
import { usePublicData } from "@/hooks/usePublicData";

/** Hero-adjacent stats strip — glass allowed here only. */
export function Stats() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const [started, setStarted] = useState(false);
  const { stats } = usePublicData();
  const list = stats;

  useEffect(() => {
    if (inView) setStarted(true);
  }, [inView]);

  if (!list.length) return null;

  return (
    <section ref={ref} className="relative z-10 -mt-4 mb-2">
      <RevealOnScroll variant="fade-up" delay={0.15}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="glass-card grid grid-cols-2 gap-4 p-6 sm:gap-6 sm:p-8 md:grid-cols-4">
            {list.map((s, i) => (
              <RevealOnScroll key={s.id} variant="fade-up" delay={i * 0.15}>
                <div className="text-center">
                  <p className="font-secondary text-2xl font-bold text-brand-navy-dark sm:text-3xl md:text-4xl">
                    {started ? (
                      <CountUp end={s.value} duration={2.2} separator="," suffix={s.suffix ?? ""} />
                    ) : (
                      `0${s.suffix ?? ""}`
                    )}
                  </p>
                  <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-brand-body sm:text-sm">
                    {s.label}
                  </p>
                </div>
              </RevealOnScroll>
            ))}
          </div>
        </div>
      </RevealOnScroll>
    </section>
  );
}
