"use client";

import Link from "next/link";
import { useEffect, useState, use } from "react";
import { SiteLayout, PageHero } from "@/components/layout/SiteLayout";
import { CourseDetailView } from "@/components/courses/CourseDetailView";
import type { Course } from "@/lib/mock";
import {
  fetchPublicCourse,
  fetchPublicCourseCurriculum,
  fetchPublicCourses,
} from "@/lib/public-api";
import { mapPublicCourse } from "@/hooks/usePublicData";

function mapCurriculumParts(
  chapters: Awaited<ReturnType<typeof fetchPublicCourseCurriculum>>,
): Course["chapters"] {
  return chapters.map((ch) => ({
    title: ch.title,
    parts: (ch.parts || []).map((p) => {
      const raw = (p.type || "video").toLowerCase();
      const type = (raw === "pdf" || raw === "notes" ? raw : "video") as
        | "video"
        | "pdf"
        | "notes";
      return {
        title: p.title,
        type,
        duration: p.duration || undefined,
        topics: (p.topics || [])
          .slice()
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          .map((t) => ({
            id: t.id != null ? String(t.id) : undefined,
            title: t.title,
          })),
      };
    }),
  }));
}

export default function CourseDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [course, setCourse] = useState<Course | null>(null);
  const [related, setRelated] = useState<Course[]>([]);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const api = await fetchPublicCourse(slug);
      if (cancelled) return;

      if (!api) {
        setMissing(true);
        return;
      }

      const curriculum = await fetchPublicCourseCurriculum(slug).catch(() => []);
      if (cancelled) return;
      const current = mapPublicCourse(api, mapCurriculumParts(curriculum));
      setCourse(current);

      const allApi = await fetchPublicCourses().catch(() => []);
      if (cancelled) return;
      const pool = allApi.map((c) => mapPublicCourse(c));
      const sameCategory = pool.filter((c) => {
        if (c.slug === current.slug) return false;
        const a = c.categories?.length ? c.categories : [c.category];
        const b = current.categories?.length ? current.categories : [current.category];
        return a.some((name) => b.includes(name));
      });
      const fallback = pool.filter((c) => c.slug !== current.slug);
      setRelated((sameCategory.length >= 3 ? sameCategory : fallback).slice(0, 3));
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (missing) {
    return (
      <SiteLayout flushTop>
        <PageHero eyebrow="Courses" title="Course not found" subtitle="This course may have been removed." />
        <div className="container-page py-12 text-center">
          <Link
            href="/courses"
            className="inline-block text-brand-navy underline transition-all duration-300 ease-in-out hover:text-brand-navy-dark"
          >
            Back to courses
          </Link>
        </div>
      </SiteLayout>
    );
  }

  if (!course) {
    return (
      <SiteLayout>
        <div className="container-page py-24 text-center text-brand-body">
          Loading course…
        </div>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <CourseDetailView course={course} related={related} />
    </SiteLayout>
  );
}
