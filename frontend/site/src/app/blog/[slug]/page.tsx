"use client";

import Link from "next/link";
import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { SiteLayout, PageHero } from "@/components/layout/SiteLayout";
import { BlogContent } from "@/components/blog/BlogContent";
import RevealOnScroll from "@/components/motion/RevealOnScroll";
import { fetchPublicBlogPost } from "@/lib/public-api";
import { resolveMediaUrl, usePublicData } from "@/hooks/usePublicData";

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
  const excerpt = post?.excerpt ?? fallback?.excerpt ?? "";
  const content = post?.content ?? (fallback as { content?: string } | undefined)?.content ?? excerpt;
  const cover =
    resolveMediaUrl(post?.cover_image) ||
    fallback?.cover ||
    "/images/theme/programming-banner.webp";

  if (!postQ.isLoading && !post && !fallback) {
    return (
      <SiteLayout flushTop>
        <PageHero eyebrow="Blog" title="Article not found" subtitle="This article may have been removed." />
        <div className="container-page py-12 text-center">
          <Link href="/blog" className="inline-block text-brand-orange underline">
            Back to blog
          </Link>
        </div>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout flushTop>
      <PageHero
        flushHeader
        eyebrow="Blog"
        title={title}
        subtitle={excerpt}
        className="!bg-[var(--blog-banner-bg)]"
      />
      <section className="section-y bg-brand-lighten-02">
        <div className="container-page mx-auto max-w-3xl">
          <RevealOnScroll variant="fade-up" delay={0.15}>
            <div className="overflow-hidden rounded-brand-lg bg-white shadow-brand-soft">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cover} alt={title} className="aspect-[16/10] w-full object-cover" />
              <div className="p-6 sm:p-8">
                <BlogContent content={content} />
              </div>
            </div>
          </RevealOnScroll>
        </div>
      </section>
    </SiteLayout>
  );
}
