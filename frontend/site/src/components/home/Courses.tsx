"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CourseCard } from "@/components/home/CourseCard";
import { mockCourseToCardProps } from "@/lib/course-card";
import { Section, SectionContainer, SectionHeading } from "@/components/brand/Section";
import RevealOnScroll, {
  THEME_DELAY,
  RevealStagger,
  staggerItem,
} from "@/components/motion/RevealOnScroll";
import { motion } from "framer-motion";
import { usePublicData } from "@/hooks/usePublicData";
import { useMemo } from "react";

/** Home courses — newest 3 from the API. */
export function Courses() {
  const { courses, featuredCourses, loading } = usePublicData();
  const list = useMemo(() => {
    const pool = courses.length ? courses : featuredCourses;
    return pool.slice(0, 3);
  }, [courses, featuredCourses]);

  if (!loading && list.length === 0) return null;

  return (
    <Section muted>
      <SectionContainer className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/theme/shape-16-1.png"
          alt=""
          className="programming-hero__float-shape pointer-events-none absolute -left-10 top-40 z-0 hidden h-auto w-12 opacity-40 xl:block"
          draggable={false}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/theme/shape-12-1.png"
          alt=""
          className="programming-hero__float-shape--xy pointer-events-none absolute -right-8 bottom-40 z-0 hidden h-auto w-10 opacity-40 xl:block"
          draggable={false}
        />
        <div className="relative z-[1]">
          <SectionHeading
            align="center"
            eyebrow="Popular Courses"
            heading="Pick A Course To Get Started"
            className="sl-section-head"
          />

          <RevealStagger className="grid justify-items-stretch gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
            {list.map((c) => (
              <motion.div key={c.slug} variants={staggerItem} className="w-full">
                <CourseCard
                  {...mockCourseToCardProps(c)}
                  category={c.category}
                  className="mx-0 max-w-none"
                />
              </motion.div>
            ))}
          </RevealStagger>

          {(courses.length > 3 || featuredCourses.length > 3) && (
            <RevealOnScroll variant="fade-up" delay={THEME_DELAY.media} className="mt-8 text-center">
              <Link
                href="/courses"
                className="sl-view-more-btn group inline-flex w-full max-w-xs sm:w-auto"
              >
                Browse more courses
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            </RevealOnScroll>
          )}
        </div>
      </SectionContainer>
    </Section>
  );
}
