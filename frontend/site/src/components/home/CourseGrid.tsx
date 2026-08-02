"use client";

import { Button } from "@/components/ui/button";
import type { Course } from "@/lib/mock";
import { CourseCard } from "@/components/home/CourseCard";
import { mockCourseToCardProps } from "@/lib/course-card";
import { Reveal, Stagger } from "@/components/motion/framer";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

type Props = { courses: Course[] };

/** Popular courses grid. */
export function CourseGrid({ courses }: Props) {
  const list = courses.slice(0, 3);

  return (
    <section className="section-y bg-white">
      <div className="container-page">
        <Reveal className="mx-auto mb-10 max-w-2xl text-center md:mb-12">
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.12em] text-[#1B3A6B]">
            Popular Courses
          </p>
          <h2 className="text-2xl font-bold text-[#231F40] sm:text-3xl md:text-[2.15rem]">
            Pick A Course To Get Started
          </h2>
        </Reveal>

        <Stagger className="grid justify-items-stretch gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
          {list.map((c) => (
            <div key={c.slug} className="w-full">
              <CourseCard
                {...mockCourseToCardProps(c)}
                category={c.category}
                className="mx-0 max-w-none"
              />
            </div>
          ))}
        </Stagger>

        <div className="mt-10 text-center">
          <Button
            asChild
            variant="outline"
            className="group h-11 rounded-md border-[#1B3A6B]/20 px-7 font-semibold text-[#1B3A6B]"
          >
            <Link href="/courses" className="inline-flex items-center gap-2">
              Browse more courses
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
