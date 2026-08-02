/**
 * Public (unauthenticated) API reads — same shapes as mock.ts with fallback.
 */

import { courseEndpoints } from "./api-endpoints";

import { resolveApiBase } from "./api-base";

const API_BASE = resolveApiBase();

async function publicGet<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
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
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return [];
    const body = await res.json();
    const data =
      body && typeof body === "object" && "data" in body ? body.data : body;
    if (Array.isArray(data)) return data as T[];
    if (data && typeof data === "object" && "results" in data) {
      return (data as { results: T[] }).results;
    }
    return [];
  } catch {
    return [];
  }
}

export type PublicCourse = {
  id: string;
  slug: string;
  title: string;
  category_name?: string | null;
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
};

export type PublicCategory = {
  id: string;
  name: string;
  slug?: string;
  icon?: string;
  course_count?: number;
};

export type PublicTestimonial = {
  id: string | number;
  name: string;
  role: string;
  content: string;
  organization?: string;
  avatar?: string | null;
};

export type PublicBlog = {
  slug: string;
  title: string;
  excerpt: string;
  published_at?: string | null;
};

export type PublicEvent = {
  slug: string;
  title: string;
  description?: string;
  location: string;
  start_datetime: string;
};

export type PublicFaq = {
  question: string;
  answer: string;
};

export type PublicGalleryItem = {
  id: string | number;
  title: string;
  image?: string | null;
  caption?: string;
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
  return publicList<PublicCourse>(`${courseEndpoints.list()}?is_published=true`);
}

export async function fetchPublicCourse(slug: string): Promise<PublicCourse | null> {
  return publicGet<PublicCourse>(courseEndpoints.detail(slug));
}

export async function fetchPublicCategories(): Promise<PublicCategory[]> {
  return publicList<PublicCategory>(courseEndpoints.categories());
}

export async function fetchPublicTestimonials(): Promise<PublicTestimonial[]> {
  return publicList<PublicTestimonial>("/cms/testimonials/?is_published=true");
}

export async function fetchPublicBlog(): Promise<PublicBlog[]> {
  return publicList<PublicBlog>("/cms/blog/?is_published=true");
}

export async function fetchPublicEvents(): Promise<PublicEvent[]> {
  return publicList<PublicEvent>("/cms/events/?is_published=true");
}

export async function fetchPublicFaqs(): Promise<PublicFaq[]> {
  const rows = await publicList<{ question: string; answer: string; is_published?: boolean }>(
    "/cms/faqs/?is_published=true",
  );
  return rows.map((f) => ({ question: f.question, answer: f.answer }));
}

export async function fetchPublicGallery(): Promise<PublicGalleryItem[]> {
  return publicList<PublicGalleryItem>("/cms/gallery/?is_published=true");
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
}): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/cms/contact-messages/`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    return false;
  }
}
