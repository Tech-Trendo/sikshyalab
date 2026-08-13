"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  Check,
  ChevronDown,
  Clock,
  Facebook,
  Instagram,
  Linkedin,
  Lock,
  PlayCircle,
  Star,
  Twitter,
  Users,
} from "lucide-react";
import { CourseCard } from "@/components/home/CourseCard";
import { PrimaryButton } from "@/components/brand/Buttons";
import { EnrollDialog } from "@/components/courses/EnrollDialog";
import { EventCard } from "@/components/events/EventCard";
import { EventRegisterDialog } from "@/components/events/EventRegisterDialog";
import { SectionContainer } from "@/components/brand/Section";
import RevealOnScroll, { STAGGER_STEP } from "@/components/motion/RevealOnScroll";
import { courseToCardProps } from "@/lib/course-card";
import { fetchPublicEventsByCourse, fetchPublicGalleryByCourse } from "@/lib/public-api";
import { resolveMediaUrl, shouldUnoptimizeImageSrc } from "@/lib/env";
import { inr, type Course } from "@/lib/mock";
import { cn } from "@/lib/utils";

type TabId = "info" | "reviews" | "events" | "gallery";

const TABS: { id: TabId; label: string }[] = [
  { id: "info", label: "Course Info" },
  { id: "reviews", label: "Reviews" },
  { id: "events", label: "Events" },
  { id: "gallery", label: "Gallery" },
];

function lessonCount(course: Course) {
  if (!Array.isArray(course.chapters)) return 0;
  return course.chapters.reduce((n, ch) => n + (Array.isArray(ch.parts) ? ch.parts.length : 0), 0);
}

function moduleDuration(parts: Course["chapters"][0]["parts"]) {
  const mins = parts.reduce((sum, p) => {
    if (!p.duration) return sum;
    const [m, s] = p.duration.split(":").map(Number);
    return sum + (m || 0) + (s || 0) / 60;
  }, 0);
  if (mins < 1) return `${parts.length * 15} min`;
  if (mins < 60) return `${Math.round(mins)} min`;
  return `${Math.floor(mins / 60)}h ${Math.round(mins % 60)}m`;
}

function Stars({ rating }: { rating: number }) {
  const filled = Math.round(rating);
  return (
    <span className="inline-flex items-center gap-0.5" aria-hidden>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            "h-3.5 w-3.5",
            i < filled ? "fill-brand-orange text-brand-orange" : "text-brand-body/30",
          )}
        />
      ))}
    </span>
  );
}

function CourseAccordion({ course }: { course: Course }) {
  const [open, setOpen] = useState(0);
  const chapters = Array.isArray(course.chapters) ? course.chapters : [];

  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-brand-border/60">
      {chapters.map((ch, i) => {
        const parts = Array.isArray(ch.parts) ? ch.parts : [];
        const isOpen = open === i;
        return (
          <div
            key={ch.title}
            className={cn(
              "border-b border-brand-border/60 last:border-b-0",
              isOpen ? "bg-brand-shade" : "bg-white",
            )}
          >
            <button
              type="button"
              className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition-all duration-300 ease-in-out hover:bg-brand-orange/5 sm:px-5"
              onClick={() => setOpen(isOpen ? -1 : i)}
              aria-expanded={isOpen}
            >
              <span className="font-semibold text-[#181818]">
                {ch.title}
              </span>
              <span className="flex shrink-0 items-center gap-3 text-sm text-brand-body">
                <span className="hidden sm:inline">
                  {parts.length} lessons · {moduleDuration(parts)}
                </span>
                <ChevronDown
                  className={cn(
                    "h-5 w-5 text-[#181818] transition-transform duration-300 ease-in-out",
                    isOpen && "rotate-180",
                  )}
                  aria-hidden
                />
              </span>
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <ul className="px-2 pb-3 sm:px-3">
                    {parts.map((p) => (
                      <li
                        key={p.title}
                        className="flex items-center justify-between gap-3 rounded-md px-3 py-2.5 text-sm text-[#181818] transition-all duration-300 ease-in-out hover:bg-brand-orange/5"
                      >
                        <span className="inline-flex min-w-0 items-center gap-2">
                          <PlayCircle className="h-4 w-4 shrink-0 text-brand-orange" aria-hidden />
                          <span className="truncate">{p.title}</span>
                        </span>
                        <span className="inline-flex shrink-0 items-center gap-2 text-xs text-brand-body">
                          {p.duration || p.type.toUpperCase()}
                          {i === 0 ? (
                            <PlayCircle className="h-3.5 w-3.5 text-[#181818]" aria-hidden />
                          ) : (
                            <Lock className="h-3.5 w-3.5 text-brand-body/50" aria-hidden />
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

function CourseInfoTab({
  course,
  expanded,
  onToggle,
}: {
  course: Course;
  expanded: boolean;
  onToggle: () => void;
}) {
  const desc = course.description;
  const short = desc.length > 220 ? `${desc.slice(0, 220)}…` : desc;
  const tags = [course.category, course.level, course.mode, "Certificate"];

  return (
    <div className="space-y-10">
      <div>
        <h4 className="font-secondary text-lg font-bold text-[#181818]">Course Description</h4>
        <p className="mt-3 text-[15px] leading-relaxed text-brand-body">
          {expanded ? desc : short}
        </p>
        {desc.length > 220 && (
          <button
            type="button"
            onClick={onToggle}
            className="mt-2 text-sm font-semibold text-brand-orange transition-all duration-300 ease-in-out hover:text-[#181818]"
          >
            {expanded ? "Show Less" : "Show More"}
          </button>
        )}
      </div>

      <div>
        <h4 className="font-secondary text-lg font-bold text-[#181818]">What Will You Learn?</h4>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {course.outcomes.map((o) => (
            <li key={o} className="flex items-start gap-3 text-[15px] text-[#181818]">
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-orange text-white">
                <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
              </span>
              {o}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h4 className="font-secondary text-lg font-bold text-[#181818]">Course Content</h4>
        {Array.isArray(course.chapters) && course.chapters.length ? (
          <>
            <p className="mt-1 text-sm text-brand-body">
              {course.chapters.length} modules · {lessonCount(course)} lessons
            </p>
            <CourseAccordion course={course} />
          </>
        ) : (
          <p className="mt-2 text-sm text-brand-body">
            Curriculum outline will be published soon. Contact us to learn more about the syllabus.
          </p>
        )}
      </div>

      <div>
        <h4 className="font-secondary text-lg font-bold text-[#181818]">Tags</h4>
        <div className="mt-3 flex flex-wrap gap-2">
          {tags.map((t) => (
            <span
              key={t}
              className="rounded-full bg-brand-shade px-3 py-1 text-xs font-semibold text-[#181818]"
            >
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function CourseDetailView({
  course,
  related,
}: {
  course: Course;
  related: Course[];
}) {
  const [tab, setTab] = useState<TabId>("info");
  const [descOpen, setDescOpen] = useState(false);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [registerFor, setRegisterFor] = useState<{ slug: string; title: string } | null>(null);
  const lessons = useMemo(() => lessonCount(course), [course]);

  const courseEventsQ = useQuery({
    queryKey: ["public", "events", "by-course", course.slug],
    queryFn: async () => {
      const rows = await fetchPublicEventsByCourse(course.slug);
      return rows.map((e) => ({
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
      }));
    },
    staleTime: 60_000,
  });

  const courseGalleryQ = useQuery({
    queryKey: ["public", "gallery", "by-course", course.slug],
    queryFn: async () => {
      const rows = await fetchPublicGalleryByCourse(course.slug);
      return rows.map((g) => ({
        id: g.id,
        title: g.title,
        image: resolveMediaUrl(g.image) || "",
      }));
    },
    staleTime: 60_000,
  });

  const previewEvents = courseEventsQ.data ?? [];
  const previewGallery = courseGalleryQ.data ?? [];

  const sidebarRows = [
    { icon: Clock, label: "Duration", value: course.duration },
    { icon: BookOpen, label: "Lessons", value: String(lessons) },
    { icon: Users, label: "Students", value: course.students.toLocaleString() },
    { icon: Star, label: "Level", value: course.level },
  ] as const;

  return (
    <div className="relative bg-white">
      {/* Full-bleed soft wash — sits outside the content container */}
      <span
        className="pointer-events-none absolute -left-24 top-24 h-56 w-56 rounded-full bg-brand-navy/5"
        aria-hidden
      />
      <span
        className="pointer-events-none absolute -right-20 bottom-40 h-48 w-48 rounded-full bg-brand-orange/10"
        aria-hidden
      />

      <SectionContainer className="relative z-[1] py-8 lg:py-12">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-brand-body">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li>
              <Link
                href="/"
                className="transition-all duration-300 ease-in-out hover:text-[#181818] hover:underline"
              >
                Home
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li>
              <Link
                href="/courses"
                className="transition-all duration-300 ease-in-out hover:text-[#181818] hover:underline"
              >
                Courses
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li className="font-medium text-[#181818] line-clamp-1">{course.title}</li>
          </ol>
        </nav>

        <div className="grid gap-10 lg:grid-cols-[1fr_360px] lg:gap-12 xl:grid-cols-[1fr_380px]">
          {/* Main ~65% */}
          <div className="min-w-0">
            <RevealOnScroll variant="fade-up" delay={0}>
              <h1 className="font-secondary text-2xl font-bold leading-snug text-[#181818] sm:text-3xl lg:text-[2.15rem]">
                {course.title}
              </h1>
              <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-brand-body">
                <span className="rounded-full bg-brand-navy/10 px-2.5 py-0.5 text-xs font-semibold text-[#181818]">
                  {course.category}
                </span>
                <span className="text-brand-border" aria-hidden>
                  ·
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Stars rating={course.rating} />
                  <span>
                    ({course.rating.toFixed(1)}
                    {course.students > 0
                      ? ` · ${course.students.toLocaleString()} learners`
                      : ""}
                    )
                  </span>
                </span>
              </div>
            </RevealOnScroll>

            {/* Tabs */}
            <RevealOnScroll variant="fade-up" delay={0.15} className="mt-8">
              <div
                role="tablist"
                aria-label="Course sections"
                className="flex flex-wrap gap-x-6 gap-y-1 border-b border-brand-border"
              >
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={tab === t.id}
                    className={cn(
                      "-mb-px border-b-2 pb-3 text-sm font-semibold transition-all duration-300 ease-in-out",
                      tab === t.id
                        ? "border-[#181818] text-[#181818]"
                        : "border-transparent text-brand-body hover:text-[#181818]",
                    )}
                    onClick={() => setTab(t.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="relative mt-8 min-h-[200px]">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={tab}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                  >
                    {tab === "info" && (
                      <CourseInfoTab
                        course={course}
                        expanded={descOpen}
                        onToggle={() => setDescOpen((v) => !v)}
                      />
                    )}
                    {tab === "reviews" && (
                      <div className="rounded-xl border border-brand-border p-6 transition-shadow duration-300 hover:shadow-brand-soft">
                        {course.rating > 0 ? (
                          <>
                            <div className="flex items-center gap-3">
                              <Stars rating={course.rating} />
                              <span className="text-sm font-semibold text-[#181818]">
                                {course.rating.toFixed(1)} average rating
                              </span>
                            </div>
                            <p className="mt-4 text-[15px] leading-relaxed text-brand-body">
                              Ratings are based on enrolled learner feedback for this program.
                            </p>
                          </>
                        ) : (
                          <p className="text-[15px] leading-relaxed text-brand-body">
                            Reviews will appear here once learners rate this course.
                          </p>
                        )}
                      </div>
                    )}
                    {tab === "events" && (
                      <div className="space-y-5">
                        {courseEventsQ.isLoading ? (
                          <p className="text-[15px] text-brand-body">Loading events…</p>
                        ) : previewEvents.length === 0 ? (
                          <div className="rounded-xl border border-brand-border p-6">
                            <p className="text-[15px] leading-relaxed text-brand-body">
                              No events linked to this course yet. Check back soon.
                            </p>
                            <Link
                              href="/events"
                              className="mt-4 inline-flex text-sm font-semibold text-[#181818] transition-colors hover:underline"
                            >
                              Browse all events
                            </Link>
                          </div>
                        ) : (
                          <>
                            <div className="grid gap-5 sm:grid-cols-2">
                              {previewEvents.map((e) => (
                                <EventCard
                                  key={e.slug}
                                  slug={e.slug}
                                  title={e.title}
                                  description={e.description}
                                  date={e.date}
                                  time={e.time}
                                  location={e.location}
                                  cover={e.cover}
                                  onRegister={() =>
                                    setRegisterFor({ slug: e.slug, title: e.title })
                                  }
                                  className="mx-0 max-w-none"
                                />
                              ))}
                            </div>
                            <Link
                              href="/events"
                              className="inline-flex text-sm font-semibold text-[#181818] transition-all hover:underline"
                            >
                              View all events
                            </Link>
                          </>
                        )}
                      </div>
                    )}
                    {tab === "gallery" && (
                      <div className="space-y-5">
                        {courseGalleryQ.isLoading ? (
                          <p className="text-[15px] text-brand-body">Loading gallery…</p>
                        ) : previewGallery.length === 0 ? (
                          <div className="rounded-xl border border-brand-border p-6">
                            <p className="text-[15px] leading-relaxed text-brand-body">
                              No gallery photos linked to this course yet.
                            </p>
                            <Link
                              href="/gallery"
                              className="mt-4 inline-flex text-sm font-semibold text-[#181818] transition-colors hover:underline"
                            >
                              Open gallery
                            </Link>
                          </div>
                        ) : (
                          <>
                            <div className="grid justify-items-stretch gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
                              {previewGallery.map((g) => (
                                <figure
                                  key={String(g.id)}
                                  className="group w-full overflow-hidden rounded-[10px] border border-brand-border/70 bg-white shadow-brand-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-brand-med"
                                >
                                  <div className="relative aspect-[16/9] w-full overflow-hidden bg-[#E8EEF6]">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={g.image}
                                      alt={g.title || "Campus life"}
                                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                                    />
                                  </div>
                                </figure>
                              ))}
                            </div>
                            <Link
                              href="/gallery"
                              className="inline-flex text-sm font-semibold text-[#181818] transition-all hover:underline"
                            >
                              View full gallery
                            </Link>
                          </>
                        )}
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </RevealOnScroll>
          </div>

          {/* Sidebar ~35% sticky */}
          <RevealOnScroll variant="fade-up" delay={0.3} className="lg:self-start">
            <aside className="sticky top-24 rounded-brand-lg bg-white p-6 shadow-brand-soft transition-shadow duration-300 hover:shadow-brand-med">
              <div className="relative mb-5 aspect-[16/9] overflow-hidden rounded-xl bg-[#E8EEF6]">
                <Image
                  key={course.cover || "placeholder"}
                  src={course.cover || "/images/theme/course-placeholder.svg"}
                  alt={course.cover ? course.title : `${course.title} — no image`}
                  fill
                  unoptimized={shouldUnoptimizeImageSrc(course.cover || "/images/theme/course-placeholder.svg")}
                  className="object-cover transition-transform duration-500 hover:scale-105"
                  sizes="(max-width: 1024px) 100vw, 380px"
                />
              </div>

              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-body">
                Course Includes:
              </p>

              <div className="mt-3 flex items-center justify-between border-b border-brand-border pb-4">
                <span className="text-sm text-brand-body">Price</span>
                <span className="font-secondary text-2xl font-bold text-[#181818]">
                  {inr(course.price)}
                </span>
              </div>

              <ul className="mt-1">
                {sidebarRows.map(({ icon: Icon, label, value }) => (
                  <li
                    key={label}
                    className="flex items-center justify-between gap-3 border-b border-brand-border py-3.5 last:border-b-0"
                  >
                    <span className="inline-flex items-center gap-2.5 text-sm text-brand-body">
                      <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-navy/10 text-[#181818] transition-colors duration-300 group-hover:bg-brand-navy group-hover:text-white">
                        <Icon className="h-4 w-4" aria-hidden />
                      </span>
                      {label}
                    </span>
                    <span className="text-sm font-bold text-[#181818]">{value}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-5">
                <PrimaryButton type="button" onClick={() => setEnrollOpen(true)}>
                  Enroll Now
                </PrimaryButton>
              </div>

              <p className="mt-6 text-xs font-semibold uppercase tracking-[0.14em] text-brand-body">
                Share On:
              </p>
              <div className="mt-3 flex gap-2">
                {[Facebook, Twitter, Linkedin, Instagram].map((Icon, i) => (
                  <button
                    key={i}
                    type="button"
                    className="grid h-10 w-10 place-items-center rounded-full bg-brand-shade text-[#181818] transition-all duration-300 ease-in-out hover:-translate-y-0.5 hover:bg-brand-orange hover:text-white"
                    aria-label="Share"
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                ))}
              </div>
            </aside>
          </RevealOnScroll>
        </div>

        {/* Related */}
        {related.length > 0 && (
          <section className="mt-16 border-t border-brand-border pt-14 lg:mt-20">
            <RevealOnScroll variant="fade-up" delay={0}>
              <h2 className="font-secondary text-2xl font-bold text-[#181818] sm:text-3xl">
                Courses You May Like
              </h2>
            </RevealOnScroll>
            <div className="mt-10 grid justify-items-stretch gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
              {related.map((c, i) => (
                <RevealOnScroll key={c.slug} variant="fade-up" delay={i * STAGGER_STEP} className="w-full">
                  <CourseCard
                    {...courseToCardProps(c)}
                    category={c.category}
                    className="mx-0 max-w-none"
                  />
                </RevealOnScroll>
              ))}
            </div>
          </section>
        )}
      </SectionContainer>

      <EnrollDialog
        open={enrollOpen}
        onOpenChange={setEnrollOpen}
        courseTitle={course.title}
      />
      <EventRegisterDialog
        open={!!registerFor}
        onOpenChange={(open) => !open && setRegisterFor(null)}
        eventSlug={registerFor?.slug || ""}
        eventTitle={registerFor?.title || ""}
      />
    </div>
  );
}
