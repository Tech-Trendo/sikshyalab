"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { use, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { BlogCard } from "@/components/blog/BlogCard";
import { BlogContent } from "@/components/blog/BlogContent";
import { BlogDetailLoading } from "@/components/blog/BlogDetailLoading";
import RevealOnScroll, { STAGGER_STEP } from "@/components/motion/RevealOnScroll";
import { SectionContainer } from "@/components/brand/Section";
import { fetchPublicBlogPost, type PublicBlogSection } from "@/lib/public-api";
import { resolveMediaUrl, usePublicData } from "@/hooks/usePublicData";
import { isStockCourseCover } from "@/lib/course-media";

const RELATED_BLOG_COUNT = 3;

function BlogSections({
  sections,
  fallbackContent,
}: {
  sections?: PublicBlogSection[];
  fallbackContent: string;
}) {
  const ordered = [...(sections || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  if (!ordered.length) {
    return fallbackContent ? <BlogContent content={fallbackContent} /> : null;
  }
  return (
    <div className="space-y-6">
      {ordered.map((section, i) => {
        const title = String(section.title || "").trim();
        const description = String(section.description || "").trim();
        const image = resolveMediaUrl(section.image);
        if (!title && !description && !image) return null;
        return (
          <section key={section.id ?? i} className="space-y-3">
            {title ? (
              <h2 className="text-left text-base font-bold leading-[1.5] text-black sm:text-lg [font-family:var(--font-heading)]">
                {title}
              </h2>
            ) : null}
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={image}
                alt={title || "Section image"}
                className="aspect-video w-full rounded-brand-lg object-cover shadow-brand-soft"
              />
            ) : null}
            {description ? (
              <div className="text-justify text-sm font-normal leading-[1.5] text-black sm:text-base [font-family:var(--font-body)]">
                <BlogContent
                  content={description}
                  className="!max-w-none !text-sm !leading-[1.5] !text-black sm:!text-base prose-p:!text-sm prose-p:!leading-[1.5] prose-p:!text-justify prose-p:!font-normal prose-p:!text-black sm:prose-p:!text-base prose-li:!text-sm prose-li:!leading-[1.5] prose-li:!text-black sm:prose-li:!text-base"
                />
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

export default function BlogDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { blog } = usePublicData();

  const postQ = useQuery({
    queryKey: ["public", "blog", slug],
    queryFn: () => fetchPublicBlogPost(slug),
    staleTime: 60_000,
  });

  const fallback = blog.find((b) => b.slug === slug);
  const post = postQ.data;
  const title = post?.title ?? fallback?.title ?? "Article";
  const content = post?.content ?? (fallback as { content?: string } | undefined)?.content ?? "";
  const coverFromPost = resolveMediaUrl(post?.cover_image);
  const coverFromFallback = fallback?.cover && !isStockCourseCover(fallback.cover) ? fallback.cover : "";
  const cover = coverFromPost && !isStockCourseCover(coverFromPost)
    ? coverFromPost
    : coverFromFallback || null;
  const sections = post?.sections;
  const category = String(post?.category || fallback?.category || "").trim();

  const related = useMemo(() => {
    const others = blog.filter((b) => b.slug !== slug);
    if (!others.length) return [];
    const sameCategory = category
      ? others.filter((b) => String(b.category || "").trim().toLowerCase() === category.toLowerCase())
      : [];
    const pool = sameCategory.length > 0 ? sameCategory : others;
    return pool.slice(0, RELATED_BLOG_COUNT);
  }, [blog, slug, category]);

  if (postQ.isLoading) {
    return (
      <SiteLayout>
        <BlogDetailLoading />
      </SiteLayout>
    );
  }

  if (!post && !fallback) {
    return (
      <SiteLayout flushTop>
        <div className="section-y bg-brand-lighten-02">
          <SectionContainer className="py-12 text-center">
            <h1 className="text-2xl font-bold">Article not found</h1>
            <p className="mt-2 text-sm text-brand-body">This article may have been removed.</p>
              <Link href="/blog" className="mt-4 inline-flex items-center gap-2 text-brand-orange underline">
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Back to blog
              </Link>
          </SectionContainer>
        </div>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <section className="section-y bg-brand-lighten-02">
        <SectionContainer>
          <RevealOnScroll variant="fade-up" delay={0.15}>
            <article className="space-y-6">
              <h1 className="text-2xl font-bold leading-[1.5] text-black sm:text-3xl [font-family:var(--font-heading)]">
                {title}
              </h1>
              {cover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={cover}
                  alt={title}
                  className="aspect-video w-full rounded-brand-lg object-cover shadow-brand-soft"
                />
              ) : null}
              <BlogSections sections={sections} fallbackContent={content} />
              <Link href="/blog" className="inline-flex items-center gap-2 text-sm text-brand-orange underline">
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Back to blog
              </Link>
            </article>
          </RevealOnScroll>

          {related.length > 0 ? (
            <section className="mt-14 border-t border-brand-border pt-12 lg:mt-16 lg:pt-14">
              <RevealOnScroll variant="fade-up" delay={0}>
                <h2 className="font-secondary text-2xl font-bold text-[#181818] sm:text-3xl">
                  Related Articles
                </h2>
              </RevealOnScroll>
              <div className="mt-8 grid gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 lg:gap-8">
                {related.map((b, i) => (
                  <RevealOnScroll key={b.slug} variant="fade-up" delay={i * STAGGER_STEP}>
                    <BlogCard post={b} />
                  </RevealOnScroll>
                ))}
              </div>
            </section>
          ) : null}
        </SectionContainer>
      </section>
    </SiteLayout>
  );
}
