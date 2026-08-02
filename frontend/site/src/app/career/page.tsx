"use client";

import Link from "next/link";
import { Briefcase, Clock, MapPin } from "lucide-react";
import { SiteLayout, PageHero } from "@/components/layout/SiteLayout";
import { Button } from "@/components/ui/button";
import { ListPagination } from "@/components/ui/ListPagination";
import RevealOnScroll from "@/components/motion/RevealOnScroll";
import { usePublicData } from "@/hooks/usePublicData";
import { useClientPagination } from "@/hooks/useClientPagination";

const PAGE_SIZE = 8;

export default function Page() {
  const { careers } = usePublicData();
  const { page, setPage, totalPages, pageItems, hasPagination } = useClientPagination(
    careers,
    PAGE_SIZE,
  );

  return (
    <SiteLayout flushTop>
      <PageHero
        eyebrow="Careers"
        title="Career Opportunities"
        subtitle="Help us shape the future of tech education."
      />
      <section className="section-y bg-brand-lighten-02">
        <div className="container-page">
          {careers.length === 0 ? (
            <p className="py-20 text-center text-brand-body">No open roles right now.</p>
          ) : (
            <>
              <div className="grid gap-6">
                {pageItems.map((j, i) => (
                  <RevealOnScroll key={`${j.title}-${i}`} variant="fade-up" delay={i * 0.08}>
                    <article className="card-brand flex flex-col justify-between gap-4 p-6 sm:flex-row sm:items-center sm:p-8">
                      <div>
                        <p className="font-secondary text-lg font-bold text-brand-navy-dark">
                          {j.title}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-4 text-sm text-brand-body">
                          <span className="inline-flex items-center gap-1.5">
                            <Briefcase className="h-3.5 w-3.5 text-brand-navy" /> {j.type}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 text-brand-navy" /> {j.location}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-brand-navy" /> {j.exp}
                          </span>
                        </div>
                        {"description" in j &&
                        typeof (j as { description?: string }).description === "string" ? (
                          <p className="mt-3 text-sm leading-relaxed text-brand-body">
                            {(j as { description?: string }).description}
                          </p>
                        ) : null}
                      </div>
                      <Button
                        className="h-11 shrink-0 rounded-full bg-brand-navy px-6 font-semibold !text-white shadow-none transition-colors duration-300 ease-in-out hover:bg-brand-orange hover:!text-white"
                        asChild
                      >
                        <Link
                          href={`/contact?message=${encodeURIComponent(`Hi, I'd like to apply for the ${j.title} role (${j.type}, ${j.location}).`)}`}
                        >
                          Apply now
                        </Link>
                      </Button>
                    </article>
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
