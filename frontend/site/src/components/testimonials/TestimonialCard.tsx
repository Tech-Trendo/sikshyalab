"use client";

import { useState } from "react";
import Image from "next/image";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SiteTestimonial } from "@/lib/testimonials";

const CLAMP_CHARS = 200;

export type TestimonialCardProps = {
  testimonial: Pick<SiteTestimonial, "id" | "name" | "role" | "quote" | "avatar" | "rating"> & {
    courseName?: string;
  };
  /** Show course name line when provided (course detail carousel) */
  showCourseName?: boolean;
  readMore?: boolean;
  className?: string;
};

export function TestimonialCard({
  testimonial: t,
  showCourseName = false,
  readMore = false,
  className,
}: TestimonialCardProps) {
  const [expanded, setExpanded] = useState(false);
  const stars = Math.min(5, Math.max(1, Math.round(t.rating || 5)));
  const long = t.quote.length > CLAMP_CHARS;
  const canExpand = readMore && long;
  const subtitle = showCourseName && t.courseName ? t.courseName : t.role;

  return (
    <article
      className={cn(
        "flex h-full min-h-[240px] w-full max-w-[450px] flex-col rounded-[12px] bg-white px-7 py-6 shadow-[0_10px_40px_rgba(0,0,0,0.06)]",
        className,
      )}
    >
      <div className="mb-3 flex shrink-0 gap-1">
        {Array.from({ length: stars }).map((_, si) => (
          <Star
            key={si}
            className="h-3.5 w-3.5 fill-brand-orange text-brand-orange"
          />
        ))}
      </div>
      <p
        className={cn(
          "min-h-0 flex-1 text-[14px] leading-[1.65] text-gray-500",
          !expanded && canExpand && "line-clamp-4",
        )}
      >
        {t.quote}
      </p>
      {canExpand ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 self-start text-xs font-semibold text-brand-navy transition-colors hover:text-brand-orange"
        >
          {expanded ? "Show less" : "Read more"}
        </button>
      ) : null}
      <div className="mt-5 flex shrink-0 items-center gap-3 border-t border-transparent pt-1">
        {t.avatar ? (
          <Image
            src={t.avatar}
            alt={t.name}
            width={48}
            height={48}
            className="h-12 w-12 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand-navy text-sm font-bold text-white">
            {t.name.slice(0, 1).toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate font-heading text-base font-bold leading-snug text-heading">
            {t.name}
          </p>
          <p className="mt-0.5 truncate text-xs leading-snug text-gray-400">{subtitle}</p>
        </div>
      </div>
    </article>
  );
}
