"use client";

import { SiteLayout, PageHero } from "@/components/layout/SiteLayout";
import { TestimonialCard } from "@/components/testimonials/TestimonialCard";
import { ListPagination } from "@/components/ui/ListPagination";
import RevealOnScroll from "@/components/motion/RevealOnScroll";
import { usePublicData } from "@/hooks/usePublicData";
import { useClientPagination } from "@/hooks/useClientPagination";

const PAGE_SIZE = 6;

export default function TestimonialsPage() {
  const { testimonials } = usePublicData();
  const { page, setPage, totalPages, pageItems, hasPagination } = useClientPagination(
    testimonials,
    PAGE_SIZE,
  );

  return (
    <SiteLayout flushTop>
      <PageHero
        flushHeader
        eyebrow="Testimonials"
        title="What Our Students Say"
        subtitle="Real feedback from graduates who completed ShikshaLab courses — industry-focused training with verifiable outcomes."
      />
      <section className="section-y bg-brand-lighten-02">
        <div className="container-page">
          {testimonials.length === 0 ? (
            <p className="py-20 text-center text-brand-body">No testimonials published yet.</p>
          ) : (
            <>
              <div className="grid justify-items-center gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
                {pageItems.map((t, i) => (
                  <RevealOnScroll key={t.id} variant="fade-up" delay={i * 0.08}>
                    <TestimonialCard testimonial={t} readMore className="mx-auto max-w-[450px]" />
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
