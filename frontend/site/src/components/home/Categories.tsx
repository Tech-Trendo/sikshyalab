"use client";

import type { ComponentType } from "react";
import Link from "next/link";
import {
  BarChart3,
  Brain,
  Camera,
  Cloud,
  Code2,
  Palette,
  Shield,
  Smartphone,
} from "lucide-react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Pagination } from "swiper/modules";
import { type Category } from "@/lib/data";
import { Section, SectionContainer, SectionHeading } from "@/components/brand/Section";
import RevealOnScroll from "@/components/motion/RevealOnScroll";
import { usePublicData } from "@/hooks/usePublicData";
import "swiper/css";
import "swiper/css/pagination";

const ICONS: Record<Category["icon"], ComponentType<{ className?: string }>> = {
  code: Code2,
  palette: Palette,
  chart: BarChart3,
  cloud: Cloud,
  shield: Shield,
  smartphone: Smartphone,
  brain: Brain,
  camera: Camera,
};

function CategoryCard({ c }: { c: Category }) {
  const Icon = ICONS[c.icon];
  return (
    <Link
      href={`/courses?category=${encodeURIComponent(c.title)}`}
      className="card-brand card-brand-hover group block h-full cursor-pointer p-6 text-brand-navy-dark"
    >
      <span
        className={`mb-4 grid h-14 w-14 place-items-center rounded-full transition-transform duration-brand ease-in-out group-hover:scale-105 ${c.tone}`}
      >
        <Icon className="h-6 w-6" />
      </span>
      <h3 className="font-secondary text-base font-bold text-brand-navy-dark sm:text-lg">{c.title}</h3>
      <p className="mt-1 text-sm text-brand-body">{c.courses} Courses</p>
    </Link>
  );
}

export function Categories() {
  const { categories } = usePublicData();
  const list = categories;
  if (!list.length) return null;

  return (
    <Section muted id="categories">
      <SectionContainer>
        <SectionHeading
          align="center"
          eyebrow="Categories"
          title="Explore Top Categories"
          description="Find the right path—from web development to AI—built for real careers."
          className="sl-section-head mx-auto max-w-2xl"
        />

        <div className="md:hidden">
          <Swiper
            modules={[Autoplay, Pagination]}
            spaceBetween={14}
            slidesPerView={1.25}
            breakpoints={{ 480: { slidesPerView: 1.6 } }}
            autoplay={{ delay: 3200, disableOnInteraction: false, pauseOnMouseEnter: true }}
            pagination={{ clickable: true }}
            className="categories-swiper !pb-12"
          >
            {list.map((c, i) => (
              <SwiperSlide key={c.id} className="!h-auto">
                <RevealOnScroll variant="fade-up" delay={i * 0.15}>
                  <CategoryCard c={c} />
                </RevealOnScroll>
              </SwiperSlide>
            ))}
          </Swiper>
        </div>

        <div className="hidden gap-6 md:grid md:grid-cols-3 lg:grid-cols-4">
          {list.map((c, i) => (
            <RevealOnScroll key={c.id} variant="fade-up" delay={i * 0.15}>
              <CategoryCard c={c} />
            </RevealOnScroll>
          ))}
        </div>
      </SectionContainer>
    </Section>
  );
}
