import { useQuery } from "@tanstack/react-query";
import {
  fetchAnnouncements,
  fetchBanners,
  fetchFeaturedCourses,
  fetchPublicBlog,
  fetchPublicCategories,
  fetchPublicCourses,
  fetchPublicEvents,
  fetchPublicFaqs,
  fetchPublicGallery,
  fetchPublicPartners,
  fetchPublicPages,
  fetchPublicTestimonials,
  fetchSiteSettings,
  fetchUpcomingBatches,
} from "@/lib/public-api";
import { faqTabs, type FaqItem } from "@/lib/data";
import { parseAboutCms } from "@/lib/about-cms";
import {
  buildSiteStats,
  groupFaqsByCategory,
  mapApiCategories,
} from "@/lib/public-mappers";
import { mapPublicTestimonialRow } from "@/lib/testimonials";
import type { Course } from "@/lib/mock";
import { resolveMediaUrl } from "@/lib/env";
import { resolveCourseThumbnail } from "@/lib/course-media";
import { newestByDate } from "@/lib/event-time";

export { resolveMediaUrl };

type CourseApiRow = Awaited<ReturnType<typeof fetchPublicCourses>>[number] & {
  category_detail?: { name?: string } | null;
  instructors?: Array<{ teacher_name?: string; is_primary?: boolean }> | null;
  chapters?: Course["chapters"];
  updated_at?: string | null;
  created_at?: string | null;
};

export function mapPublicCourse(c: CourseApiRow, chapters?: Course["chapters"]): Course {
  const weeks = c.duration_weeks;
  const categoryNames =
    Array.isArray((c as { category_names?: string[] }).category_names) &&
    (c as { category_names?: string[] }).category_names!.length
      ? (c as { category_names: string[] }).category_names
      : c.category_name || c.category_detail?.name
        ? [c.category_name || c.category_detail?.name || "General"]
        : ["General"];
  const category = categoryNames[0] || "General";
  const primaryFromList =
    (c.instructors || []).find((i) => i.is_primary)?.teacher_name ||
    (c.instructors || [])[0]?.teacher_name;
  const instructor = c.primary_instructor?.name || primaryFromList || "—";
  // Only use a real API thumbnail — never substitute a stock photo for null.
  const cover = resolveCourseThumbnail(c.thumbnail, c.updated_at);

  const normalizedChapters = Array.isArray(chapters)
    ? chapters
    : Array.isArray(c.chapters)
      ? c.chapters
      : [];
  const outcomes = Array.isArray(c.learning_outcomes) ? c.learning_outcomes : [];
  const whyThisCourseTitle = String(c.why_this_course_title || "").trim();
  const highlights = Array.isArray(c.highlights)
    ? c.highlights
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const heading = String(item.heading || item.title || "").trim();
          const description = String(item.description || item.body || "").trim();
          if (!heading && !description) return null;
          return { heading, description };
        })
        .filter((item): item is { heading: string; description: string } => item != null)
    : [];
  const faqs = Array.isArray(c.faqs)
    ? c.faqs
        .map((f) => ({
          id: f.id != null ? String(f.id) : undefined,
          question: String(f.question || "").trim(),
          answer: String(f.answer || "").trim(),
          order: f.order ?? 0,
        }))
        .filter((f) => f.question && f.answer)
        .sort((a, b) => a.order - b.order)
    : [];

  return {
    id: c.id ? String(c.id) : undefined,
    slug: c.slug,
    title: c.title,
    category,
    categories: categoryNames,
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
    duration: weeks ? `${weeks} weeks` : "—",
    price: Number(c.discount_price ?? c.price ?? 0),
    rating: c.rating ?? 0,
    students: c.students_count ?? 0,
    instructor,
    cover,
    tagline: c.short_description || "",
    description: c.description || c.short_description || "",
    outcomes,
    whyThisCourseTitle: whyThisCourseTitle || undefined,
    highlights: highlights.length ? highlights : undefined,
    faqs: faqs.length ? faqs : undefined,
    createdAt: c.created_at || c.updated_at || undefined,
    chapters: normalizedChapters,
  };
}

export const publicKeys = {
  courses: ["public", "courses"] as const,
  featuredCourses: ["public", "featured-courses"] as const,
  categories: ["public", "categories"] as const,
  testimonials: ["public", "testimonials"] as const,
  blog: ["public", "blog"] as const,
  events: ["public", "events"] as const,
  faqs: ["public", "faqs"] as const,
  gallery: ["public", "gallery"] as const,
  partners: ["public", "partners"] as const,
  settings: ["public", "settings"] as const,
  banners: ["public", "banners"] as const,
  aboutPage: ["public", "about-page"] as const,
  contactPage: ["public", "contact-page"] as const,
  upcomingBatches: ["public", "upcoming-batches"] as const,
  announcements: ["public", "announcements"] as const,
};

/** Public marketing data — live API only (no mock fallback). */
export function usePublicData() {
  const settingsQ = useQuery({
    queryKey: publicKeys.settings,
    queryFn: fetchSiteSettings,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const bannersQ = useQuery({
    queryKey: publicKeys.banners,
    queryFn: () => fetchBanners("HOME"),
    staleTime: 120_000,
  });

  const coursesQ = useQuery({
    queryKey: publicKeys.courses,
    queryFn: async () => {
      const rows = await fetchPublicCourses();
      return newestByDate(
        rows.map((c) => mapPublicCourse(c)),
        (c) => c.createdAt,
      );
    },
    staleTime: 60_000,
  });

  const featuredQ = useQuery({
    queryKey: publicKeys.featuredCourses,
    queryFn: async () => {
      const featured = await fetchFeaturedCourses();
      if (featured.length) {
        return newestByDate(
          featured.map((c) => mapPublicCourse(c)),
          (c) => c.createdAt,
        );
      }
      const all = await fetchPublicCourses();
      return newestByDate(
        all.map((c) => mapPublicCourse(c)),
        (c) => c.createdAt,
      ).slice(0, 6);
    },
    staleTime: 60_000,
  });

  const categoriesQ = useQuery({
    queryKey: publicKeys.categories,
    queryFn: async () => {
      const rows = await fetchPublicCategories();
      return mapApiCategories(
        rows.map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          icon: c.icon,
          course_count: c.course_count ?? c.children_count,
        })),
      );
    },
    staleTime: 60_000,
  });

  const testimonialsQ = useQuery({
    queryKey: publicKeys.testimonials,
    queryFn: async () => {
      const rows = await fetchPublicTestimonials();
      return rows.map(mapPublicTestimonialRow);
    },
    staleTime: 60_000,
  });

  const blogQ = useQuery({
    queryKey: publicKeys.blog,
    queryFn: async () => {
      const rows = await fetchPublicBlog();
      return rows
        .map((b) => ({
          slug: b.slug,
          title: b.title,
          excerpt: b.excerpt,
          content: b.content || "",
          author: b.author_name || "ShikshaLab",
          category: String(b.category || "").trim(),
          publishedAt: b.published_at || "",
          date: b.published_at
            ? new Date(b.published_at).toLocaleDateString("en-US", {
                month: "short",
                day: "2-digit",
                year: "numeric",
              })
            : "",
          cover: resolveMediaUrl(b.cover_image) || "/images/theme/programming-banner.webp",
        }))
        .sort((a, b) => {
          const ta = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
          const tb = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
          return tb - ta;
        });
    },
    staleTime: 60_000,
  });

  const eventsQ = useQuery({
    queryKey: publicKeys.events,
    queryFn: async () => {
      const rows = await fetchPublicEvents();
      return newestByDate(
        rows.map((e) => ({
          slug: e.slug,
          title: e.title,
          date: new Date(e.start_datetime).toLocaleDateString("en-US", {
            month: "short",
            day: "2-digit",
            year: "numeric",
          }),
          time: new Date(e.start_datetime).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          location: e.location,
          tag: "Event",
          description: e.description || "",
          cover:
            resolveMediaUrl(e.cover_image) || "/images/theme/programming-banner.webp",
          startsAt: e.start_datetime,
          endsAt: e.end_datetime || null,
          createdAt: e.created_at || e.start_datetime,
        })),
        (e) => e.createdAt,
      );
    },
    staleTime: 60_000,
  });

  const faqsQ = useQuery({
    queryKey: publicKeys.faqs,
    queryFn: async () => {
      const rows = await fetchPublicFaqs();
      if (!rows.length) {
        return {
          tabs: [...faqTabs] as string[],
          groups: {} as Record<string, FaqItem[]>,
          flat: [] as FaqItem[],
        };
      }
      const { tabs, groups } = groupFaqsByCategory(rows, faqTabs);
      const flat = rows.map((f) => ({ q: f.question, a: f.answer }));
      return { tabs, groups, flat };
    },
    staleTime: 60_000,
  });

  const galleryQ = useQuery({
    queryKey: publicKeys.gallery,
    queryFn: async () => {
      const rows = await fetchPublicGallery();
      return rows
        .map((g) => ({
          id: g.id,
          title: g.title,
          category: g.category || "",
          image: resolveMediaUrl(g.image) || "",
          event: g.event ?? undefined,
          event_title: g.event_title,
        }))
        .filter((g) => Boolean(g.image));
    },
    staleTime: 60_000,
  });

  const partnersQ = useQuery({
    queryKey: publicKeys.partners,
    queryFn: async () => {
      const rows = await fetchPublicPartners();
      return rows
        .map((p) => ({
          id: p.id,
          name: p.name || "",
          logo: resolveMediaUrl(p.logo) || "",
          website_url: p.website_url || "",
        }))
        .filter((p) => Boolean(p.logo));
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const announcementsQ = useQuery({
    queryKey: publicKeys.announcements,
    queryFn: async () => {
      const rows = await fetchAnnouncements();
      return rows.map((a) => ({
        id: a.id,
        title: a.title,
        content: a.content,
        priority: a.priority,
      }));
    },
    staleTime: 60_000,
  });

  const aboutPageQ = useQuery({
    queryKey: publicKeys.aboutPage,
    queryFn: async () => {
      const pages = await fetchPublicPages("ABOUT");
      const page = pages[0] ?? null;
      if (!page) return null;
      return {
        ...page,
        featured_image: resolveMediaUrl(page.featured_image),
      };
    },
    staleTime: 120_000,
  });

  const contactPageQ = useQuery({
    queryKey: publicKeys.contactPage,
    queryFn: async () => {
      const pages = await fetchPublicPages("CONTACT");
      return pages[0] ?? null;
    },
    staleTime: 120_000,
  });

  const batchesQ = useQuery({
    queryKey: publicKeys.upcomingBatches,
    queryFn: async () => {
      const rows = await fetchUpcomingBatches();
      return rows.map((b) => ({
        course: b.course,
        slug: b.slug,
        start: b.start,
        shift: b.shift || "—",
        seats: Number(b.seats ?? 0),
        mode: b.mode || "—",
      }));
    },
    staleTime: 60_000,
  });

  const courses = coursesQ.data ?? [];
  const featuredCourses =
    featuredQ.data && featuredQ.data.length ? featuredQ.data : courses.slice(0, 6);
  const settingsRaw = settingsQ.data;
  const settings = settingsRaw
    ? {
        ...settingsRaw,
        logo: resolveMediaUrl(settingsRaw.logo),
        homepage_features: (settingsRaw.homepage_features || []).map((f) => ({
          ...f,
          image: resolveMediaUrl(f.image) || f.image,
        })),
      }
    : undefined;
  const social = settings?.social_links || {};
  const events = eventsQ.data ?? [];
  const upcomingBatches = batchesQ.data ?? [];
  const gallery = galleryQ.data ?? [];
  const partners = partnersQ.data ?? [];

  const contact = {
    email: settings?.contact_email || "",
    phone: settings?.contact_phone || "",
    address: settings?.address || "",
    latitude: settings?.latitude ?? null,
    longitude: settings?.longitude ?? null,
  };

  const heroBanner = bannersQ.data?.[0];
  const hero = {
    title: heroBanner?.title || social.hero_title || "",
    subtitle: heroBanner?.subtitle || settings?.tagline || "",
    ctaText: heroBanner?.cta_text || social.hero_cta || "Find courses",
    ctaUrl: heroBanner?.cta_url || social.hero_cta_url || "/courses",
    image: resolveMediaUrl(heroBanner?.image) || undefined,
  };

  const faqData = faqsQ.data ?? {
    tabs: [] as string[],
    groups: {} as Record<string, FaqItem[]>,
    flat: [] as FaqItem[],
  };

  const stats = buildSiteStats(courses, upcomingBatches.length, events.length);

  return {
    courses,
    featuredCourses,
    categories: categoriesQ.data ?? [],
    testimonials: testimonialsQ.data ?? [],
    blog: blogQ.data ?? [],
    events,
    faqs: faqData.flat,
    faqTabs: faqData.tabs,
    faqGroups: faqData.groups,
    gallery,
    partners,
    /** @deprecated use `partners` — kept for About strip compatibility */
    partnerLogos: partners.map((p) => ({
      id: p.id,
      title: p.name || "Partner",
      image: p.logo,
      category: "Partners",
    })),
    announcements: announcementsQ.data ?? [],
    settings,
    contact,
    hero,
    cta: {
      title: social.cta_title || "",
      description: social.cta_description || "",
      ctaText: social.cta_text || "Get Started",
      ctaUrl: social.cta_url || "/courses",
    },
    aboutPage: aboutPageQ.data,
    contactPage: contactPageQ.data,
    aboutBenefits: (() => {
      const cms = parseAboutCms(aboutPageQ.data?.content);
      if (cms.pillars.some((p) => p.title || p.description)) {
        return cms.pillars.map((p) => p.title).filter(Boolean);
      }
      return cms.intro
        ? cms.intro
            .split(/\n+/)
            .map((line) => line.replace(/^[-•*]\s*/, "").trim())
            .filter(Boolean)
            .slice(0, 6)
        : [];
    })(),
    stats,
    upcomingBatches,
    loading:
      coursesQ.isLoading ||
      featuredQ.isLoading ||
      categoriesQ.isLoading ||
      testimonialsQ.isLoading ||
      blogQ.isLoading ||
      eventsQ.isLoading ||
      faqsQ.isLoading ||
      galleryQ.isLoading ||
      partnersQ.isLoading ||
      batchesQ.isLoading ||
      aboutPageQ.isLoading ||
      contactPageQ.isLoading ||
      settingsQ.isLoading ||
      announcementsQ.isLoading,
  };
}
