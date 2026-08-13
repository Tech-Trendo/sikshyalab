"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  Clock,
  Star,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EnrollDialog } from "@/components/courses/EnrollDialog";
import {
  COURSE_THUMBNAIL_PLACEHOLDER,
  isStockCourseCover,
} from "@/lib/course-media";
import { inr } from "@/lib/currency";
import { MediaImage } from "@/components/media/MediaImage";
import { isDjangoMediaSrc, resolveMediaUrl } from "@/lib/env";

export interface CourseCardProps {
  /** Resolved thumbnail URL; empty/null shows the explicit placeholder. */
  imageUrl?: string | null;
  /** Duration badge on the image, e.g. "15 Hours" */
  duration: string;
  level: string;
  category?: string;
  title: string;
  slug?: string;
  rating: number;
  ratingCount: number;
  price: number;
  description: string;
  lessonsCount: number;
  studentsCount: number;
  /** @deprecated Enroll Now opens the enrollment popup */
  onEnroll?: () => void;
  className?: string;
  variant?: "light" | "dark";
}

function formatPrice(value: number) {
  return inr(value);
}

function RatingStars({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-0.5", className)} aria-hidden>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className="h-3.5 w-3.5 fill-brand-orange text-brand-orange" />
      ))}
    </div>
  );
}

/**
 * Course card — stays light on hover; image zooms like other home cards.
 * Real API thumbnails only; stock/missing → explicit placeholder (not a fake course photo).
 */
export function CourseCard({
  imageUrl,
  duration,
  level,
  title,
  slug,
  rating,
  ratingCount,
  price,
  lessonsCount,
  studentsCount,
  className,
}: CourseCardProps) {
  const [enrollOpen, setEnrollOpen] = useState(false);
  const ratingLabel = `(${rating.toFixed(1)} / ${ratingCount} Rating${ratingCount === 1 ? "" : "s"})`;
  const detailHref = slug ? `/courses/${slug}` : "/courses";

  const hasRealImage = Boolean(imageUrl) && !isStockCourseCover(imageUrl);
  const rawSrc = hasRealImage ? imageUrl! : COURSE_THUMBNAIL_PLACEHOLDER;
  const src = resolveMediaUrl(rawSrc) || rawSrc;
  const unoptimized =
    isDjangoMediaSrc(src) || /^https?:\/\//i.test(src) || src.endsWith(".svg");

  return (
    <article
      className={cn(
        "group relative mx-auto flex h-full w-full max-w-md flex-col overflow-hidden rounded-[10px] bg-white lg:max-w-none",
        "border border-brand-border/80 shadow-brand-soft",
        "transition-transform duration-[400ms] ease-[cubic-bezier(0.215,0.61,0.355,1)]",
        "hover:-translate-y-1.5 hover:shadow-brand-med",
        className,
      )}
    >
      <div className="relative aspect-[16/9] w-full shrink-0 overflow-hidden rounded-t-[10px] bg-[#E8EEF6]">
        <MediaImage
          key={src}
          src={src}
          alt={hasRealImage ? title : `${title} — no image`}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          unoptimized={unoptimized}
          className="object-cover transition-transform duration-[400ms] ease-[cubic-bezier(0.215,0.61,0.355,1)] group-hover:scale-105"
        />
        <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-[5px] bg-brand-orange px-2.5 py-1 text-xs font-semibold text-white">
          <Clock className="h-3.5 w-3.5" aria-hidden />
          {duration}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <span className="inline-flex w-fit rounded-full bg-brand-navy/10 px-2.5 py-0.5 text-xs font-semibold text-brand-navy">
          {level}
        </span>

        <h3 className="mt-3 line-clamp-2 font-secondary text-base font-bold leading-snug text-brand-navy-dark transition-colors duration-brand group-hover:text-brand-navy">
          {title}
        </h3>

        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <RatingStars />
          <span className="text-xs text-brand-body">{ratingLabel}</span>
        </div>

        <p className="mt-3 text-lg font-bold text-brand-navy">{formatPrice(price)}</p>

        <div className="mt-4 border-t border-brand-navy/10 pt-4">
          <div className="flex flex-wrap items-center gap-3 text-sm text-brand-body">
            <span className="inline-flex items-center gap-1.5">
              <BookOpen className="h-4 w-4" aria-hidden />
              {lessonsCount} Lessons
            </span>
            <span className="h-4 w-px bg-brand-navy/20" aria-hidden />
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-4 w-4" aria-hidden />
              {studentsCount} Students
            </span>
          </div>
        </div>

        <div className="sl-card-cta-pair mt-4">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setEnrollOpen(true);
            }}
            className="sl-card-cta sl-card-cta--primary"
          >
            Enroll now
          </button>
          <Link
            href={detailHref}
            onClick={(e) => e.stopPropagation()}
            className="sl-card-cta sl-card-cta--secondary"
          >
            Learn more
          </Link>
        </div>
      </div>

      <EnrollDialog
        open={enrollOpen}
        onOpenChange={setEnrollOpen}
        courseTitle={title}
      />
    </article>
  );
}
