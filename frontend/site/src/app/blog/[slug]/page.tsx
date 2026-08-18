"use client";

import Link from "next/link";
import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { BlogContent } from "@/components/blog/BlogContent";
import RevealOnScroll from "@/components/motion/RevealOnScroll";
import { SectionContainer } from "@/components/brand/Section";
import { fetchPublicBlogPost, type PublicBlogSection } from "@/lib/public-api";
import { resolveMediaUrl, usePublicData } from "@/hooks/usePublicData";

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
        if (!title && !description) return null;
        return (
          <section key={section.id ?? i} className="space-y-2">
            {title ? (
              <h2 className="text-center text-base font-bold leading-[1.5] text-black sm:text-lg [font-family:var(--font-heading)]">
                {title}
              </h2>
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
  const cover =
    resolveMediaUrl(post?.cover_image) ||
    fallback?.cover ||
    "/images/theme/programming-banner.webp";
  const sections = post?.sections;

  if (!postQ.isLoading && !post && !fallback) {
    return (
      <SiteLayout flushTop>
        <div className="section-y bg-brand-lighten-02">
          <SectionContainer className="py-12 text-center">
            <h1 className="text-2xl font-bold">Article not found</h1>
            <p className="mt-2 text-sm text-brand-body">This article may have been removed.</p>
            <Link href="/blog" className="mt-4 inline-block text-brand-orange underline">
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
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={cover}
                alt={title}
                className="aspect-video w-full rounded-brand-lg object-cover shadow-brand-soft"
              />
              <BlogSections sections={sections} fallbackContent={content} />
              <Link href="/blog" className="inline-block text-sm text-brand-orange underline">
                Back to blog
              </Link>
            </article>
          </RevealOnScroll>
        </SectionContainer>
      </section>
    </SiteLayout>
  );
}
