import type { Category } from "@/lib/data";
import type { FaqItem } from "@/lib/data";
import type { Stat } from "@/lib/data";
import type { Course } from "@/lib/mock";

const CATEGORY_TONES = [
  "bg-brand-lighten-01 text-brand-orange",
  "bg-brand-lighten-01 text-brand-navy",
  "bg-brand-lighten-02 text-brand-navy",
  "bg-brand-lighten-02 text-brand-orange",
  "bg-brand-shade text-brand-navy",
  "bg-brand-lighten-01 text-brand-navy-dark",
  "bg-brand-lighten-02 text-brand-orange",
  "bg-brand-shade text-brand-navy",
] as const;

const ICON_ALIASES: Record<string, Category["icon"]> = {
  code: "code",
  code2: "code",
  terminal: "code",
  palette: "palette",
  design: "palette",
  chart: "chart",
  brain: "brain",
  braincircuit: "brain",
  cloud: "cloud",
  shield: "shield",
  shieldcheck: "shield",
  smartphone: "smartphone",
  mobile: "smartphone",
  camera: "camera",
  megaphone: "camera",
};

function normalizeIcon(raw?: string): Category["icon"] {
  if (!raw) return "code";
  const key = raw.replace(/[^a-z]/gi, "").toLowerCase();
  return ICON_ALIASES[key] ?? "code";
}

export function mapApiCategories(
  rows: { id: string; name: string; slug?: string; icon?: string; course_count?: number; children_count?: number }[],
): Category[] {
  return rows.map((c, i) => ({
    id: c.slug || c.id,
    title: c.name,
    courses: c.course_count ?? c.children_count ?? 0,
    icon: normalizeIcon(c.icon),
    tone: CATEGORY_TONES[i % CATEGORY_TONES.length],
  }));
}

export function groupFaqsByCategory(
  rows: { question: string; answer: string; category?: string }[],
  fallbackTabs: readonly string[],
): { tabs: string[]; groups: Record<string, FaqItem[]> } {
  if (!rows.length) {
    return { tabs: [...fallbackTabs], groups: {} };
  }

  const groups: Record<string, FaqItem[]> = {};
  for (const row of rows) {
    const tab = row.category?.trim() || fallbackTabs[0] || "General";
    if (!groups[tab]) groups[tab] = [];
    groups[tab].push({ q: row.question, a: row.answer });
  }

  const tabs = Object.keys(groups).sort((a, b) => {
    const ai = fallbackTabs.indexOf(a as (typeof fallbackTabs)[number]);
    const bi = fallbackTabs.indexOf(b as (typeof fallbackTabs)[number]);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  return { tabs, groups };
}

export function buildSiteStats(
  courses: Course[],
  batchCount = 0,
  eventCount = 0,
): Stat[] {
  const totalStudents = courses.reduce((sum, c) => sum + (c.students || 0), 0);
  const stats: Stat[] = [];
  if (totalStudents > 0) {
    stats.push({ id: "students", label: "Students", value: totalStudents, suffix: "+" });
  }
  if (courses.length > 0) {
    stats.push({ id: "courses", label: "Courses", value: courses.length, suffix: "+" });
  }
  if (batchCount > 0) {
    stats.push({ id: "batches", label: "Live Batches", value: batchCount, suffix: "+" });
  } else if (eventCount > 0) {
    stats.push({ id: "events", label: "Events", value: eventCount, suffix: "+" });
  }
  return stats;
}

export const DEFAULT_CONTACT = {
  email: "",
  phone: "",
  address: "",
};

export const DEFAULT_HERO = {
  title: "",
  subtitle: "",
  ctaText: "Find courses",
  ctaUrl: "/courses",
};

export const DEFAULT_CTA = {
  title: "",
  description: "",
  ctaText: "Get Started",
  ctaUrl: "/courses",
};
