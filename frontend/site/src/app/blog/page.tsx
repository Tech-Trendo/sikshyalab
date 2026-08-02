"use client";

import { SiteLayout, PageHero } from "@/components/layout/SiteLayout";
import { BlogCard } from "@/components/blog/BlogCard";
import { ListPagination } from "@/components/ui/ListPagination";
import RevealOnScroll from "@/components/motion/RevealOnScroll";
import { usePublicData } from "@/hooks/usePublicData";
import { useClientPagination } from "@/hooks/useClientPagination";

const PAGE_SIZE = 9;

export default function BlogPage() {
  const { blog } = usePublicData();
  const { page, setPage, totalPages, pageItems, hasPagination } = useClientPagination(
    blog,
    PAGE_SIZE,
  );

  return (
    <SiteLayout flushTop>
      <PageHero
        flushHeader
        eyebrow="Blog"
        title="Latest Articles"
        subtitle="Expert guides and practical learning insights from ShikshaLab mentors — read the summary on each card, then learn more."
      />
      <section className="section-y bg-brand-lighten-02">
        <div className="container-page">
          {blog.length === 0 ? (
            <p className="py-20 text-center text-brand-body">No articles published yet.</p>
          ) : (
            <>
              <div className="grid gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 lg:gap-8">
                {pageItems.map((b, i) => (
                  <RevealOnScroll key={b.slug} variant="fade-up" delay={i * 0.1}>
                    <BlogCard post={b} />
                  </RevealOnScroll>
                ))}
              </div>
              {hasPagination ? (
                <ListPagination page={page} totalPages={totalPages} onPageChange={setPage} />
              ) : null}
            </>
          )}
        </div>
      </section>
    </SiteLayout>
  );
}
