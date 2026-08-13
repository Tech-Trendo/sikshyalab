"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { shouldUnoptimizeImageSrc } from "@/lib/env";
import { cn } from "@/lib/utils";

export type BlogCardPost = {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  cover: string;
  author?: string;
  category?: string;
};

type Props = {
  post: BlogCardPost;
  className?: string;
  /** Home layout: image on top, flat content below (no card chrome). */
  variant?: "card" | "flat";
};

export function BlogCard({ post, className, variant = "card" }: Props) {
  const detailHref = `/blog/${post.slug}`;

  const cardShell =
    variant === "flat"
      ? "group flex h-full flex-col overflow-hidden rounded-[10px] bg-white shadow-brand-soft transition-shadow duration-300 hover:shadow-brand-med"
      : "card-brand card-brand-hover group flex h-full flex-col overflow-hidden shadow-brand-soft";

  return (
    <article className={cn(cardShell, className)}>
      <Link href={detailHref} className="block shrink-0">
        <div
          className={cn(
            "relative aspect-[16/10] w-full overflow-hidden",
            variant === "flat" && "rounded-[10px]",
          )}
        >
          <Image
            src={post.cover}
            alt={post.title}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            unoptimized={shouldUnoptimizeImageSrc(post.cover)}
            className="object-cover transition-transform duration-[400ms] ease-[cubic-bezier(0.215,0.61,0.355,1)] group-hover:scale-105"
          />
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <h3 className="line-clamp-2 font-secondary text-lg font-bold leading-snug text-[#181818] transition-colors duration-brand group-hover:text-brand-navy">
          {post.title}
        </h3>

        {post.excerpt ? (
          <p className="mt-3 line-clamp-3 flex-1 text-sm leading-relaxed text-[#6F6B80]">
            {post.excerpt}
          </p>
        ) : (
          <p className="mt-3 line-clamp-3 flex-1 text-sm leading-relaxed text-[#6F6B80]">
            Practical learning tips and guidance from our mentors to help you grow your skills.
          </p>
        )}

        <div className="mt-5">
          <Link href={detailHref} className="sl-hero-btn sl-hero-btn--yellow group inline-flex !h-11 !min-h-11 w-full !px-4 !text-sm sm:w-auto">
            Learn more
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        </div>
      </div>
    </article>
  );
}
