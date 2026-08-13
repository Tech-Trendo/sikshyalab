"use client";

import Image from "next/image";
import Link from "next/link";
import { Calendar, Clock, MapPin } from "lucide-react";
import { shouldUnoptimizeImageSrc } from "@/lib/env";
import { cn } from "@/lib/utils";

export type EventCardProps = {
  slug: string;
  title: string;
  description?: string;
  date: string;
  time: string;
  location: string;
  cover: string;
  onRegister?: () => void;
  className?: string;
};

/**
 * Event card — same visual language as CourseCard (image, body, dual CTAs).
 */
export function EventCard({
  slug,
  title,
  description,
  date,
  time,
  location,
  cover,
  onRegister,
  className,
}: EventCardProps) {
  const detailHref = `/events/${slug}`;

  return (
    <article
      className={cn(
        "group relative mx-auto flex w-full max-w-md flex-col overflow-hidden rounded-[10px] bg-white lg:max-w-none",
        "border border-brand-border/80 shadow-brand-soft",
        "transition-transform duration-[400ms] ease-[cubic-bezier(0.215,0.61,0.355,1)]",
        "hover:-translate-y-1.5 hover:shadow-brand-med",
        className,
      )}
    >
      <div className="relative aspect-[16/9] w-full shrink-0 overflow-hidden rounded-t-[10px] bg-[#E8EEF6]">
        <Image
          src={cover}
          alt={title}
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          unoptimized={shouldUnoptimizeImageSrc(cover)}
          className="object-cover transition-transform duration-[400ms] ease-[cubic-bezier(0.215,0.61,0.355,1)] group-hover:scale-105"
        />
        <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-[5px] bg-brand-orange px-2.5 py-1 text-xs font-semibold text-white">
          <Calendar className="h-3.5 w-3.5" aria-hidden />
          {date}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <h3 className="line-clamp-2 font-secondary text-base font-bold leading-snug text-brand-navy-dark transition-colors duration-brand group-hover:text-brand-orange sm:text-lg">
          {title}
        </h3>

        {description ? (
          <p className="mt-2.5 line-clamp-3 text-sm leading-relaxed text-brand-body">
            {description}
          </p>
        ) : null}

        <div className="mt-4 border-t border-brand-navy/10 pt-4">
          <div className="flex flex-col gap-2 text-sm text-brand-body">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-4 w-4 shrink-0 text-brand-navy" aria-hidden />
              {time}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-4 w-4 shrink-0 text-brand-navy" aria-hidden />
              <span className="line-clamp-1">{location}</span>
            </span>
          </div>
        </div>

        <div className="sl-card-cta-pair mt-4">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRegister?.();
            }}
            className="sl-card-cta sl-card-cta--primary"
          >
            Register now
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
    </article>
  );
}
