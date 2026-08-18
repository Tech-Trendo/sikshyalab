import type { PublicTestimonial } from "@/lib/public-api";
import { resolveMediaUrl } from "@/lib/env";

export type SiteTestimonial = {
  id: string;
  name: string;
  role: string;
  quote: string;
  avatar?: string;
  rating: number;
  /** When the API exposes review/course linkage */
  courseName?: string;
  courseId?: string;
  courseSlug?: string;
};

export function mapPublicTestimonialRow(t: PublicTestimonial, index: number): SiteTestimonial {
  const courseName =
    String(t.course_name || t.course_title || "").trim() ||
    undefined;
  const courseId = t.course_id != null ? String(t.course_id) : undefined;
  const courseSlug = t.course_slug?.trim() || undefined;

  return {
    id: t.id != null ? String(t.id) : `${t.name}-${index}`,
    name: t.name,
    role: t.role || t.organization || "Graduate",
    quote: t.content,
    avatar: resolveMediaUrl(t.avatar) || undefined,
    rating: t.rating ?? 5,
    courseName,
    courseId,
    courseSlug,
  };
}

function norm(value: string) {
  return value.trim().toLowerCase();
}

export type CourseTestimonialFilterResult = {
  items: SiteTestimonial[];
  /** True when at least one testimonial matched the course */
  matchedCourse: boolean;
  /** True when no API course field matched and all published testimonials are shown */
  usedFallbackAll: boolean;
};

/** Client-side course filter — no dedicated API filter on Testimonial today. */
export function filterTestimonialsForCourse(
  testimonials: SiteTestimonial[],
  course: { id?: string; slug: string; title: string },
): CourseTestimonialFilterResult {
  const titleNorm = norm(course.title);

  const byApiFields = testimonials.filter((t) => {
    if (t.courseSlug && t.courseSlug === course.slug) return true;
    if (t.courseId && course.id && t.courseId === course.id) return true;
    if (t.courseName && norm(t.courseName) === titleNorm) return true;
    return false;
  });
  if (byApiFields.length) {
    return { items: byApiFields, matchedCourse: true, usedFallbackAll: false };
  }

  const byRoleOrOrg = testimonials.filter((t) => {
    if (norm(t.role) === titleNorm) return true;
    if (t.courseName && norm(t.courseName) === titleNorm) return true;
    return false;
  });
  if (byRoleOrOrg.length) {
    return { items: byRoleOrOrg, matchedCourse: true, usedFallbackAll: false };
  }

  if (!testimonials.length) {
    return { items: [], matchedCourse: false, usedFallbackAll: false };
  }

  return {
    items: testimonials,
    matchedCourse: false,
    usedFallbackAll: true,
  };
}
