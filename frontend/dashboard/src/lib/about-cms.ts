/**
 * About Us CMS payload stored in CMS Page.content (JSON).
 * Legacy plaintext content is treated as the homepage intro.
 */

export const ABOUT_LIFE_BANNER_PLACEMENT = "ABOUT";

export type AboutCardItem = {
  title: string;
  description: string;
  icon?: string;
};

export type AboutLifeAt = {
  heading: string;
  description: string;
  image?: string;
};

export type AboutCmsPayload = {
  v: 1;
  intro: string;
  heroTitle: string;
  heroBreadcrumb: string;
  pillars: AboutCardItem[];
  whyChoose: AboutCardItem[];
  partnersHeading: string;
  lifeAt: AboutLifeAt;
};

export const DEFAULT_ABOUT_PILLARS: AboutCardItem[] = [
  {
    title: "Our Mission",
    description:
      "Empower learners with practical, industry-aligned programs that lead to real careers.",
  },
  {
    title: "Our Vision",
    description: "Be Nepal’s most trusted skills institute for job-ready technology education.",
  },
  {
    title: "Core Values",
    description: "Integrity, hands-on learning, and student success in every program we run.",
  },
];

export const DEFAULT_WHY_CHOOSE: AboutCardItem[] = [
  {
    title: "High Quality Courses",
    description:
      "Project-based programs designed to help you build real skills and career-ready portfolios.",
  },
  {
    title: "Life Time Access",
    description:
      "Learn at your pace with lasting access to course materials, updates, and community support.",
  },
  {
    title: "Expert Instructors",
    description:
      "Learn from industry mentors who guide you through practical projects and career growth.",
  },
];

export function defaultAboutCms(intro = ""): AboutCmsPayload {
  return {
    v: 1,
    intro,
    heroTitle: "About ShikshaLab",
    heroBreadcrumb: "About Us",
    pillars: DEFAULT_ABOUT_PILLARS.map((p) => ({ ...p })),
    whyChoose: DEFAULT_WHY_CHOOSE.map((p) => ({ ...p })),
    partnersHeading: "Our Hiring Partners",
    lifeAt: {
      heading: "Life at ShikshaLab",
      description:
        "A look at our classrooms, events, and student community — the people and moments behind every course.",
      image: "",
    },
  };
}

export function parseAboutCms(raw?: string | null): AboutCmsPayload {
  const text = String(raw || "").trim();
  if (text.startsWith("{")) {
    try {
      const parsed = JSON.parse(text) as Partial<AboutCmsPayload> & { v?: number };
      if (parsed && parsed.v === 1) {
        const base = defaultAboutCms();
        return {
          v: 1,
          intro: String(parsed.intro || ""),
          heroTitle: String(parsed.heroTitle || base.heroTitle),
          heroBreadcrumb: String(parsed.heroBreadcrumb || base.heroBreadcrumb),
          pillars: Array.isArray(parsed.pillars) && parsed.pillars.length
            ? parsed.pillars.map((p) => ({
                title: String(p?.title || "").trim(),
                description: String(p?.description || "").trim(),
                icon: String(p?.icon || "").trim() || undefined,
              }))
            : base.pillars,
          whyChoose: Array.isArray(parsed.whyChoose) && parsed.whyChoose.length
            ? parsed.whyChoose.map((p) => ({
                title: String(p?.title || "").trim(),
                description: String(p?.description || "").trim(),
                icon: String(p?.icon || "").trim() || undefined,
              }))
            : base.whyChoose,
          partnersHeading: String(parsed.partnersHeading || base.partnersHeading),
          lifeAt: {
            heading: String(parsed.lifeAt?.heading || base.lifeAt.heading),
            description: String(parsed.lifeAt?.description || base.lifeAt.description),
            image: String(parsed.lifeAt?.image || ""),
          },
        };
      }
    } catch {
      /* legacy plaintext */
    }
  }
  return defaultAboutCms(text);
}

export function serializeAboutCms(payload: AboutCmsPayload): string {
  return JSON.stringify({
    v: 1,
    intro: payload.intro || "",
    heroTitle: payload.heroTitle || "About ShikshaLab",
    heroBreadcrumb: payload.heroBreadcrumb || "About Us",
    pillars: payload.pillars,
    whyChoose: payload.whyChoose,
    partnersHeading: payload.partnersHeading || "Our Hiring Partners",
    lifeAt: payload.lifeAt,
  });
}
