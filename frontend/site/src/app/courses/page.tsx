"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { SiteLayout, PageHero } from "@/components/layout/SiteLayout";
import { CourseCard } from "@/components/home/CourseCard";
import { mockCourseToCardProps } from "@/lib/course-card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import RevealOnScroll from "@/components/motion/RevealOnScroll";
import { usePublicData } from "@/hooks/usePublicData";
import { courseCategoryNames, groupCoursesByCategory } from "@/lib/course-categories";

function CoursesContent() {
  const { courses, categories } = usePublicData();
  const searchParams = useSearchParams();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [mode, setMode] = useState("all");

  useEffect(() => {
    setQ(searchParams.get("q") ?? "");
    const categoryParam = searchParams.get("category");
    if (categoryParam) setCat(categoryParam);
  }, [searchParams]);

  const categoryOptions = useMemo(() => {
    const fromCms = categories.map((c) => c.title).filter(Boolean);
    const fromCourses = courses.flatMap((c) => courseCategoryNames(c));
    return [...new Set([...fromCms, ...fromCourses])];
  }, [categories, courses]);

  const list = useMemo(
    () =>
      courses.filter((c) => {
        const cats = courseCategoryNames(c);
        const qLower = q.toLowerCase();
        const matchesQ =
          !qLower ||
          c.title.toLowerCase().includes(qLower) ||
          c.tagline.toLowerCase().includes(qLower) ||
          cats.some((name) => name.toLowerCase().includes(qLower));
        const matchesCat = cat === "all" || cats.includes(cat);
        const matchesMode = mode === "all" || c.mode === mode;
        return matchesQ && matchesCat && matchesMode;
      }),
    [courses, q, cat, mode],
  );

  const grouped = useMemo(() => {
    if (cat !== "all") {
      return [{ category: cat, courses: list }];
    }
    return groupCoursesByCategory(list, {
      mode: "primary",
      categoryOrder: categoryOptions,
    });
  }, [list, cat, categoryOptions]);

  return (
    <>
      <PageHero
        eyebrow="Courses"
        title="Our Courses"
        subtitle="Pick a live, project-based program and start building career-ready skills."
      />
      <section className="section-y bg-brand-lighten-02">
        <div className="container-page">
          <RevealOnScroll variant="fade-up" delay={0.15}>
            <div className="mb-10 grid grid-cols-1 gap-3 rounded-brand-lg bg-white p-4 shadow-brand-soft sm:grid-cols-2 md:grid-cols-4 md:p-5">
              <Input
                placeholder="Search courses…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="h-11 rounded-brand border-brand-border sm:col-span-2"
              />
              <Select value={cat} onValueChange={setCat}>
                <SelectTrigger className="h-11 rounded-brand border-brand-border">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {categoryOptions.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={mode} onValueChange={setMode}>
                <SelectTrigger className="h-11 rounded-brand border-brand-border">
                  <SelectValue placeholder="Mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All modes</SelectItem>
                  <SelectItem value="Online">Online</SelectItem>
                  <SelectItem value="Physical">Physical</SelectItem>
                  <SelectItem value="Hybrid">Hybrid</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </RevealOnScroll>

          {grouped.map((group) => (
            <section key={group.category} className="mb-12 last:mb-0">
              <div className="mb-5 flex items-end justify-between gap-3 border-b border-brand-border/70 pb-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[1.5px] text-brand-orange">
                    Category
                  </p>
                  <h2 className="font-heading text-xl font-bold text-brand-navy-dark sm:text-2xl">
                    {group.category}
                  </h2>
                </div>
                <p className="text-sm text-brand-body">
                  {group.courses.length} course{group.courses.length === 1 ? "" : "s"}
                </p>
              </div>
              <div className="grid justify-items-stretch gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
                {group.courses.map((c, i) => (
                  <RevealOnScroll key={c.slug} variant="fade-up" delay={i * 0.06} className="w-full">
                    <CourseCard
                      {...mockCourseToCardProps(c)}
                      category={c.category}
                      className="mx-0 max-w-none"
                    />
                  </RevealOnScroll>
                ))}
              </div>
            </section>
          ))}

          {list.length === 0 && (
            <p className="py-20 text-center text-brand-body">No courses match your filters.</p>
          )}
        </div>
      </section>
    </>
  );
}

export default function CoursesPage() {
  return (
    <SiteLayout flushTop>
      <Suspense fallback={<div className="container-page section-y text-brand-body">Loading courses…</div>}>
        <CoursesContent />
      </Suspense>
    </SiteLayout>
  );
}
