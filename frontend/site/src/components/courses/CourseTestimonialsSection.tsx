"use client";

import Link from "next/link";
import { useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, FreeMode } from "swiper/modules";
import type { Swiper as SwiperType } from "swiper";
import { TestimonialCard } from "@/components/testimonials/TestimonialCard";
import { fetchPublicTestimonials } from "@/lib/public-api";
import {
  filterTestimonialsForCourse,
  mapPublicTestimonialRow,
  type SiteTestimonial,
} from "@/lib/testimonials";
import type { Course } from "@/lib/mock";
import { cn } from "@/lib/utils";

import "swiper/css";

type Props = {
  course: Pick<Course, "id" | "slug" | "title">;
};

function withCourseName(items: SiteTestimonial[], courseTitle: string) {
  return items.map((t) => ({
    ...t,
    courseName: t.courseName || courseTitle,
  }));
}

export function CourseTestimonialsSection({ course }: Props) {
  const swiperRef = useRef<SwiperType | null>(null);
  const resumeTimerRef = useRef<number | null>(null);

  const query = useQuery({
    queryKey: ["public", "testimonials", "course", course.slug],
    queryFn: async () => {
      const rows = await fetchPublicTestimonials();
      return rows.map(mapPublicTestimonialRow);
    },
    staleTime: 60_000,
  });

  const filtered = useMemo(() => {
    if (!query.data?.length) return { items: [] as SiteTestimonial[] };
    const result = filterTestimonialsForCourse(query.data, course);
    return {
      items: withCourseName(result.items, course.title),
    };
  }, [query.data, course]);

  const items = filtered.items;
  const enableAutoScroll = items.length > 3;

  const pauseAutoplay = () => {
    swiperRef.current?.autoplay?.stop();
  };

  const resumeAutoplay = () => {
    if (!enableAutoScroll) return;
    if (resumeTimerRef.current) window.clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = window.setTimeout(() => {
      swiperRef.current?.autoplay?.start();
    }, 2000);
  };

  if (query.isLoading || items.length === 0) return null;

  return (
    <section
      className="mt-16 border-t border-brand-border pt-14 lg:mt-20"
      aria-labelledby="course-testimonials-heading"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2
            id="course-testimonials-heading"
            className="font-secondary text-2xl font-bold text-[#181818] sm:text-3xl"
          >
            What our students say
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-brand-body sm:text-[15px]">
            Hear from graduates who have completed our courses.
          </p>
        </div>
        <Link
          href="/testimonials"
          className="shrink-0 text-sm font-semibold text-brand-navy transition-colors hover:text-brand-orange"
        >
          view all student testimonials →
        </Link>
      </div>

      {enableAutoScroll ? (
        <div
          className="relative mt-8 overflow-hidden"
          onMouseEnter={pauseAutoplay}
          onMouseLeave={() => swiperRef.current?.autoplay?.start()}
          onTouchStart={pauseAutoplay}
          onTouchEnd={resumeAutoplay}
        >
          <Swiper
            modules={[Autoplay, FreeMode]}
            onSwiper={(s) => {
              swiperRef.current = s;
            }}
            loop
            freeMode={{ enabled: true, momentum: true }}
            slidesPerView="auto"
            spaceBetween={20}
            speed={12000}
            autoplay={{
              delay: 0,
              disableOnInteraction: false,
              pauseOnMouseEnter: true,
            }}
            className="w-full overflow-hidden"
          >
            {[...items, ...items].map((t, i) => (
              <SwiperSlide key={`${t.id}-${i}`} className="!w-auto max-w-[450px]">
                <TestimonialCard testimonial={t} showCourseName readMore className="max-w-[450px]" />
              </SwiperSlide>
            ))}
          </Swiper>
        </div>
      ) : (
        <div
          className={cn(
            "mt-8 grid gap-5",
            items.length === 1 && "max-w-[450px]",
            items.length === 2 && "sm:grid-cols-2",
            items.length === 3 && "sm:grid-cols-2 lg:grid-cols-3",
          )}
        >
          {items.map((t) => (
            <TestimonialCard key={t.id} testimonial={t} showCourseName readMore />
          ))}
        </div>
      )}
    </section>
  );
}
