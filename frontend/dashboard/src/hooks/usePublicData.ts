import { useQuery } from "@tanstack/react-query";
import {
  fetchPublicBlog,
  fetchPublicCategories,
  fetchPublicCourses,
  fetchPublicEvents,
  fetchPublicFaqs,
  fetchPublicGallery,
  fetchPublicTestimonials,
} from "@/lib/public-api";
import type { Course } from "@/lib/mock";

export function mapPublicCourse(c: Awaited<ReturnType<typeof fetchPublicCourses>>[number]): Course {
  const weeks = c.duration_weeks;
  return {
    slug: c.slug,
    title: c.title,
    category: c.category_name || "General",
    level: (c.level?.includes("ADVANCED")
      ? "Advanced"
      : c.level?.includes("INTERMEDIATE")
        ? "Intermediate"
        : "Beginner") as Course["level"],
    mode: (c.enrollment_type === "PHYSICAL"
      ? "Physical"
      : c.enrollment_type === "HYBRID"
        ? "Hybrid"
        : "Online") as Course["mode"],
    duration: weeks ? `${weeks} months` : "—",
    price: Number(c.discount_price ?? c.price ?? 0),
    rating: c.rating ?? null,
    students: 0,
    instructor: c.primary_instructor?.name || "—",
    cover: c.thumbnail || "/images/theme/programming-banner.webp",
    tagline: c.short_description || "",
    description: c.description || c.short_description || "",
    outcomes: Array.isArray(c.learning_outcomes) ? c.learning_outcomes : [],
    chapters: [],
  };
}

export const publicKeys = {
  courses: ["public", "courses"] as const,
  categories: ["public", "categories"] as const,
  testimonials: ["public", "testimonials"] as const,
  blog: ["public", "blog"] as const,
  events: ["public", "events"] as const,
  faqs: ["public", "faqs"] as const,
  gallery: ["public", "gallery"] as const,
};

/** Dashboard public preview data — API only, no mock fallback. */
export function usePublicData() {
  const coursesQ = useQuery({
    queryKey: publicKeys.courses,
    queryFn: async () => {
      const rows = await fetchPublicCourses();
      return rows.map(mapPublicCourse);
    },
    staleTime: 60_000,
  });

  const categoriesQ = useQuery({
    queryKey: publicKeys.categories,
    queryFn: async () => {
      const rows = await fetchPublicCategories();
      return rows.map((c) => ({
        name: c.name,
        icon: c.icon || "BookOpen",
        count: c.course_count ?? 0,
      }));
    },
    staleTime: 60_000,
  });

  const testimonialsQ = useQuery({
    queryKey: publicKeys.testimonials,
    queryFn: async () => {
      const rows = await fetchPublicTestimonials();
      return rows.map((t) => ({
        name: t.name,
        role: t.role || t.organization || "Graduate",
        quote: t.content,
        avatar: t.avatar || "",
      }));
    },
    staleTime: 60_000,
  });

  const blogQ = useQuery({
    queryKey: publicKeys.blog,
    queryFn: async () => {
      const rows = await fetchPublicBlog();
      return rows.map((b) => {
        const row = b as typeof b & {
          author_name?: string;
          cover_image?: string | null;
        };
        return {
          slug: row.slug,
          title: row.title,
          excerpt: row.excerpt,
          date: row.published_at
            ? new Date(row.published_at).toLocaleDateString("en-US", {
                month: "short",
                day: "2-digit",
                year: "numeric",
              })
            : "",
          author: row.author_name || "ShikshaLab",
          cover: row.cover_image || "",
        };
      });
    },
    staleTime: 60_000,
  });

  const eventsQ = useQuery({
    queryKey: publicKeys.events,
    queryFn: async () => {
      const rows = await fetchPublicEvents();
      return rows.map((e) => {
        const row = e as typeof e & { cover_image?: string | null };
        return {
          title: row.title,
          date: new Date(row.start_datetime).toLocaleDateString("en-US", {
            month: "short",
            day: "2-digit",
            year: "numeric",
          }),
          time: new Date(row.start_datetime).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          location: row.location,
          tag: "Event",
          slug: row.slug,
          description: row.description || "",
          cover: row.cover_image || "",
        };
      });
    },
    staleTime: 60_000,
  });

  const faqsQ = useQuery({
    queryKey: publicKeys.faqs,
    queryFn: async () => {
      const rows = await fetchPublicFaqs();
      return rows.map((f) => ({ q: f.question, a: f.answer }));
    },
    staleTime: 60_000,
  });

  const galleryQ = useQuery({
    queryKey: publicKeys.gallery,
    queryFn: async () => {
      const rows = await fetchPublicGallery();
      return rows.map((g) => g.image).filter((src): src is string => Boolean(src));
    },
    staleTime: 60_000,
  });

  return {
    courses: coursesQ.data ?? [],
    categories: categoriesQ.data ?? [],
    testimonials: testimonialsQ.data ?? [],
    blog: blogQ.data ?? [],
    events: eventsQ.data ?? [],
    faqs: faqsQ.data ?? [],
    gallery: galleryQ.data ?? [],
    upcomingBatches: [] as {
      course: string;
      start: string;
      shift: string;
      seats: number;
      mode: string;
    }[],
    loading:
      coursesQ.isLoading ||
      categoriesQ.isLoading ||
      testimonialsQ.isLoading ||
      blogQ.isLoading ||
      eventsQ.isLoading ||
      faqsQ.isLoading ||
      galleryQ.isLoading,
  };
}
