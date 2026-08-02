"use client";

import { useCallback, useEffect } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, Quote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Reveal } from "@/components/motion/framer";

export function TestimonialsSection({
  testimonials,
}: {
  testimonials: { name: string; role: string; quote: string; avatar: string }[];
}) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: "start" });

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    const t = window.setInterval(() => emblaApi.scrollNext(), 6500);
    return () => window.clearInterval(t);
  }, [emblaApi]);

  if (!testimonials.length) return null;

  return (
    <section className="section-y bg-[#F5F7FA]">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="mb-10 flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-brand-orange">
                Stories
              </p>
              <h2 className="mt-2 font-display text-3xl font-bold text-brand-navy-dark sm:text-4xl">
                What our graduates say
              </h2>
            </div>
            <div className="hidden gap-2 sm:flex">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="rounded-full"
                onClick={scrollPrev}
                aria-label="Previous testimonial"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="rounded-full"
                onClick={scrollNext}
                aria-label="Next testimonial"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Reveal>

        <div className="overflow-hidden" ref={emblaRef}>
          <div className="flex gap-6">
            {testimonials.map((t) => (
              <article
                key={`${t.name}-${t.role}`}
                className="min-w-0 shrink-0 grow-0 basis-full sm:basis-[calc(50%-12px)] lg:basis-[calc(33.333%-16px)]"
              >
                <div className="flex h-full flex-col rounded-2xl bg-white p-6 shadow-sm">
                  <Quote className="mb-4 h-8 w-8 text-brand-orange/80" />
                  <p className="flex-1 text-brand-body leading-relaxed">{t.quote}</p>
                  <div className="mt-6 flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={t.avatar} alt={t.name} />
                      <AvatarFallback>{t.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold text-brand-navy-dark">{t.name}</p>
                      <p className="text-sm text-brand-body">{t.role}</p>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
