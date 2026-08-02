/**
 * Public (unauthenticated) API reads for the marketing site.
 */

import { apiBase } from "@/lib/env";

async function publicGet<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${apiBase()}${path}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const body = await res.json();
    if (body && typeof body === "object" && "data" in body) return body.data as T;
    return body as T;
  } catch {
    return null;
  }
}

async function publicList<T>(path: string): Promise<T[]> {
  try {
    const join = path.includes("?") ? "&" : "?";
    const all: T[] = [];
    let page = 1;
    const pageSize = 100;

    for (let guard = 0; guard < 50; guard += 1) {
      const res = await fetch(`${apiBase()}${path}${join}page=${page}&page_size=${pageSize}`, {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) return all.length ? all : [];

      const body = await res.json();
      const data =
        body && typeof body === "object" && "data" in body ? body.data : body;
      const meta =
        body && typeof body === "object" && "meta" in body
          ? (body.meta as { total_pages?: number; next?: string | null })
          : undefined;

      let rows: T[] = [];
      if (Array.isArray(data)) rows = data as T[];
      else if (data && typeof data === "object" && "results" in data) {
        rows = (data as { results: T[] }).results;
      }

      all.push(...rows);

      const totalPages = Number(meta?.total_pages || 1);
      if (page >= totalPages || rows.length === 0 || (!meta?.next && rows.length < pageSize)) {
        break;
      }
      page += 1;
    }

    return all;
  } catch {
    return [];
  }
}

export type PublicCourse = {
  id: string;
  slug: string;
  title: string;
  category_name?: string | null;
  category_names?: string[];
  categories?: string[];
  level?: string;
  enrollment_type?: string;
  duration_weeks?: number | null;
  price?: string | number;
  discount_price?: string | number | null;
  thumbnail?: string | null;
  short_description?: string;
  description?: string;
  learning_outcomes?: string[];
  primary_instructor?: { name?: string } | null;
  rating?: number;
  is_featured?: boolean;
  students_count?: number;
};

export type PublicCategory = {
  id: string;
  name: string;
  slug?: string;
  icon?: string;
  course_count?: number;
  children_count?: number;
};

export type PublicTestimonial = {
  id: string | number;
  name: string;
  role: string;
  content: string;
  organization?: string;
  avatar?: string | null;
  rating?: number;
};

export type PublicBlog = {
  slug: string;
  title: string;
  excerpt: string;
  content?: string;
  author_name?: string;
  cover_image?: string | null;
  category?: string;
  published_at?: string | null;
};

export type PublicEvent = {
  slug: string;
  title: string;
  description?: string;
  location: string;
  start_datetime: string;
  end_datetime?: string | null;
  cover_image?: string | null;
  course?: string | null;
  course_title?: string | null;
  course_slug?: string | null;
};

export type PublicFaq = {
  id?: string | number;
  question: string;
  answer: string;
  category?: string;
};

export type PublicGalleryItem = {
  id: string | number;
  title: string;
  image?: string | null;
  category?: string;
  caption?: string;
  event?: string | number | null;
  event_title?: string;
  event_slug?: string;
  course_slug?: string;
  course_title?: string;
};

export type PublicPartner = {
  id: string | number;
  name?: string;
  logo?: string | null;
  website_url?: string;
};

export type PublicAnnouncement = {
  id: string | number;
  title: string;
  content: string;
  priority?: string;
  audience?: string;
  cta_url?: string;
};

export type PublicSiteSetting = {
  site_name?: string;
  tagline?: string;
  logo?: string | null;
  contact_email?: string;
  contact_phone?: string;
  address?: string;
  social_links?: Record<string, string>;
  footer_text?: string;
  features_eyebrow?: string;
  features_heading?: string;
  homepage_features?: Array<{ title: string; description: string; image: string }>;
  testimonials_eyebrow?: string;
  testimonials_heading?: string;
};

export type PublicBanner = {
  id: string | number;
  title: string;
  subtitle?: string;
  image?: string | null;
  mobile_image?: string | null;
  cta_text?: string;
  cta_url?: string;
  placement?: string;
};

export type PublicTeacherHighlight = {
  id: string | number;
  teacher_name?: string;
  designation?: string;
  department?: string;
  bio?: string;
  blurb?: string;
};

export type PublicCareer = {
  id: string | number;
  title: string;
  slug?: string;
  department?: string;
  location?: string;
  employment_type?: string;
  description?: string;
  requirements?: string;
};

export type PublicUpcomingBatch = {
  id?: string | number;
  code?: string;
  course: string;
  slug: string;
  start: string;
  shift: string;
  seats: number;
  mode: string;
  status?: string;
};

export type PublicPage = {
  id: string | number;
  title: string;
  slug: string;
  content?: string;
  page_type?: string;
  featured_image?: string | null;
};

export type PublicCertificateVerify = {
  certificate_number?: string;
  verification_code?: string;
  student_name?: string;
  course_title?: string;
  issue_date?: string;
  completion_date?: string;
  status?: string;
  status_display?: string;
  instructor_name?: string;
  institute_name?: string;
  is_valid?: boolean;
};

export async function fetchPublicCourses(): Promise<PublicCourse[]> {
  return publicList<PublicCourse>("/courses/courses/?is_published=true");
}

export async function fetchFeaturedCourses(): Promise<PublicCourse[]> {
  return publicList<PublicCourse>("/courses/courses/featured/");
}

export async function fetchPublicCourse(slug: string): Promise<PublicCourse | null> {
  return publicGet<PublicCourse>(`/courses/courses/${slug}/`);
}

export type PublicCurriculumChapter = {
  title: string;
  description?: string;
  parts: Array<{
    title: string;
    type?: string;
    duration?: string | null;
    is_preview?: boolean;
  }>;
};

export async function fetchPublicCourseCurriculum(
  slug: string,
): Promise<PublicCurriculumChapter[]> {
  const data = await publicGet<PublicCurriculumChapter[] | { results?: PublicCurriculumChapter[] }>(
    `/courses/courses/${encodeURIComponent(slug)}/curriculum/`,
  );
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.results)) return data.results;
  return [];
}

export async function fetchPublicCategories(): Promise<PublicCategory[]> {
  return publicList<PublicCategory>("/courses/categories/");
}

export async function fetchPublicTestimonials(): Promise<PublicTestimonial[]> {
  return publicList<PublicTestimonial>("/cms/testimonials/?is_published=true");
}

export async function fetchPublicBlog(): Promise<PublicBlog[]> {
  return publicList<PublicBlog>("/cms/blog/?is_published=true");
}

export async function fetchPublicBlogPost(slug: string): Promise<PublicBlog | null> {
  return publicGet<PublicBlog>(`/cms/blog/${slug}/`);
}

export async function fetchPublicEvents(): Promise<PublicEvent[]> {
  return publicList<PublicEvent>("/cms/events/?is_published=true");
}

/** Published events linked to a course (backend filter: course_slug). */
export async function fetchPublicEventsByCourse(
  courseSlug: string,
): Promise<PublicEvent[]> {
  const slug = courseSlug.trim();
  if (!slug) return [];
  return publicList<PublicEvent>(
    `/cms/events/?is_published=true&course_slug=${encodeURIComponent(slug)}`,
  );
}

export async function fetchPublicEvent(slug: string): Promise<PublicEvent | null> {
  return publicGet<PublicEvent>(`/cms/events/${encodeURIComponent(slug)}/`);
}

export async function submitEventRegistration(payload: {
  event_slug: string;
  name: string;
  email: string;
  phone?: string;
  message?: string;
}): Promise<{ ok: boolean; message?: string }> {
  try {
    const res = await fetch(`${apiBase()}/cms/event-registrations/`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => null);
    if (res.ok) {
      return {
        ok: true,
        message:
          (body && typeof body === "object" && "message" in body
            ? String((body as { message?: string }).message)
            : undefined) || undefined,
      };
    }
    let message = "Could not submit registration.";
    if (body && typeof body === "object") {
      const bag =
        "errors" in body && (body as { errors?: unknown }).errors
          ? (body as { errors: Record<string, unknown> }).errors
          : (body as Record<string, unknown>);
      if (bag && typeof bag === "object") {
        for (const key of ["email", "event_slug", "name", "phone", "message", "non_field_errors"]) {
          const val = bag[key];
          if (Array.isArray(val) && val[0]) {
            message = String(val[0]);
            break;
          }
          if (typeof val === "string" && val) {
            message = val;
            break;
          }
        }
      }
      if (message === "Could not submit registration." && "message" in body) {
        message = String((body as { message?: string }).message || message);
      }
    }
    return { ok: false, message };
  } catch {
    return { ok: false, message: "Network error. Please try again." };
  }
}

export async function fetchPublicFaqs(): Promise<PublicFaq[]> {
  return publicList<PublicFaq>("/cms/faqs/?is_published=true");
}

export async function fetchPublicGallery(): Promise<PublicGalleryItem[]> {
  return publicList<PublicGalleryItem>("/cms/gallery/?is_published=true");
}

/** Published gallery images for a course (backend filter: course_slug). */
export async function fetchPublicGalleryByCourse(
  courseSlug: string,
): Promise<PublicGalleryItem[]> {
  const slug = courseSlug.trim();
  if (!slug) return [];
  return publicList<PublicGalleryItem>(
    `/cms/gallery/?is_published=true&course_slug=${encodeURIComponent(slug)}`,
  );
}

export async function fetchPublicPartners(): Promise<PublicPartner[]> {
  return publicList<PublicPartner>("/cms/partners/?is_published=true");
}

export async function fetchAnnouncements(): Promise<PublicAnnouncement[]> {
  return publicList<PublicAnnouncement>(
    "/cms/announcements/?is_published=true&audience=ALL",
  );
}

export async function fetchSiteSettings(): Promise<PublicSiteSetting | null> {
  return publicGet<PublicSiteSetting>("/cms/settings/current/");
}

export async function fetchBanners(placement = "HOME"): Promise<PublicBanner[]> {
  return publicList<PublicBanner>(
    `/cms/banners/?placement=${encodeURIComponent(placement)}&is_published=true&is_active=true`,
  );
}

export async function fetchTeacherHighlights(): Promise<PublicTeacherHighlight[]> {
  return publicList<PublicTeacherHighlight>("/cms/teacher-highlights/?is_published=true");
}

export async function fetchCareers(): Promise<PublicCareer[]> {
  return publicList<PublicCareer>("/cms/careers/?is_published=true&is_active=true");
}

export async function fetchUpcomingBatches(): Promise<PublicUpcomingBatch[]> {
  return publicList<PublicUpcomingBatch>("/batches/batches/upcoming/");
}

export async function fetchPublicPages(pageType?: string): Promise<PublicPage[]> {
  const params = new URLSearchParams({ is_published: "true" });
  if (pageType) params.set("page_type", pageType);
  return publicList<PublicPage>(`/cms/pages/?${params.toString()}`);
}

export async function verifyPublicCertificate(code: string): Promise<PublicCertificateVerify | null> {
  const trimmed = code.trim();
  if (!trimmed) return null;
  return publicGet<PublicCertificateVerify>(`/certificates/verify/${encodeURIComponent(trimmed)}/`);
}

export async function submitContactMessage(payload: {
  name: string;
  email: string;
  phone?: string;
  subject?: string;
  message: string;
}): Promise<{ ok: boolean; message?: string }> {
  try {
    const body = {
      name: payload.name.trim(),
      email: payload.email.trim(),
      phone: (payload.phone || "").trim(),
      subject: (payload.subject || "Website contact").trim() || "Website contact",
      message: payload.message.trim(),
    };
    const res = await fetch(`${apiBase()}/cms/contact-messages/`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) return { ok: true };
    const errBody = await res.json().catch(() => null);
    let message = "Could not send message.";
    if (errBody && typeof errBody === "object") {
      const bag =
        "errors" in errBody && (errBody as { errors?: unknown }).errors
          ? (errBody as { errors: Record<string, unknown> }).errors
          : (errBody as Record<string, unknown>);
      if (bag && typeof bag === "object") {
        for (const key of ["subject", "email", "name", "phone", "message", "non_field_errors"]) {
          const val = bag[key];
          if (Array.isArray(val) && val[0]) {
            message = String(val[0]);
            break;
          }
          if (typeof val === "string" && val) {
            message = val;
            break;
          }
        }
      }
      if (message === "Could not send message." && "message" in errBody) {
        message = String((errBody as { message?: string }).message || message);
      }
    }
    return { ok: false, message };
  } catch {
    return { ok: false, message: "Network error. Please try again." };
  }
}
