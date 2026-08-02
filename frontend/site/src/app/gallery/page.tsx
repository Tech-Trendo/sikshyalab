"use client";

import { useMemo, useState } from "react";
import { SiteLayout, PageHero } from "@/components/layout/SiteLayout";
import { ListPagination } from "@/components/ui/ListPagination";
import RevealOnScroll from "@/components/motion/RevealOnScroll";
import { usePublicData } from "@/hooks/usePublicData";
import { useClientPagination } from "@/hooks/useClientPagination";

const PAGE_SIZE = 9;

export default function GalleryPage() {
  const { gallery } = usePublicData();
  const [eventFilter, setEventFilter] = useState("all");

  const eventOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const g of gallery) {
      if (g.event && g.event_title) map.set(String(g.event), g.event_title);
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [gallery]);

  const filtered = useMemo(
    () =>
      eventFilter === "all"
        ? gallery
        : gallery.filter((g) => String(g.event ?? "") === eventFilter),
    [gallery, eventFilter],
  );

  const { page, setPage, totalPages, pageItems, hasPagination } = useClientPagination(
    filtered,
    PAGE_SIZE,
  );

  return (
    <SiteLayout flushTop>
      <PageHero
        eyebrow="Gallery"
        title="Classroom Moments"
        subtitle="A look at learning, projects, and community at ShikshaLab."
      />
      <section className="section-y bg-brand-lighten-02">
        <div className="container-page">
          {eventOptions.length > 0 ? (
            <div className="mb-8 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setEventFilter("all")}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                  eventFilter === "all"
                    ? "bg-[#1B3A6B] text-white"
                    : "bg-white text-brand-body ring-1 ring-brand-border hover:text-[#1B3A6B]"
                }`}
              >
                All
              </button>
              {eventOptions.map(([id, title]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setEventFilter(id)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                    eventFilter === id
                      ? "bg-[#1B3A6B] text-white"
                      : "bg-white text-brand-body ring-1 ring-brand-border hover:text-[#1B3A6B]"
                  }`}
                >
                  {title}
                </button>
              ))}
            </div>
          ) : null}

          <div className="grid justify-items-stretch gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
            {pageItems.map((g, i) => (
              <RevealOnScroll key={String(g.id)} variant="fade-up" delay={i * 0.05} className="w-full">
                <figure className="group overflow-hidden rounded-[10px] border border-brand-border/70 bg-white shadow-brand-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-brand-med">
                  <div className="relative aspect-[16/9] w-full overflow-hidden bg-[#E8EEF6]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={g.image}
                      alt={g.title || "Campus life"}
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                </figure>
              </RevealOnScroll>
            ))}
          </div>

          {filtered.length === 0 && (
            <p className="py-20 text-center text-brand-body">No photos in this filter yet.</p>
          )}

          {hasPagination ? (
            <ListPagination page={page} totalPages={totalPages} onPageChange={setPage} />
          ) : null}
        </div>
      </section>
    </SiteLayout>
  );
}
