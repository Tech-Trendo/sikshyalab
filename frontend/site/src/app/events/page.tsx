"use client";

import { useState } from "react";
import { SiteLayout, PageHero } from "@/components/layout/SiteLayout";
import { EventCard } from "@/components/events/EventCard";
import { EventRegisterDialog } from "@/components/events/EventRegisterDialog";
import { ListPagination } from "@/components/ui/ListPagination";
import { usePublicData } from "@/hooks/usePublicData";
import { useClientPagination } from "@/hooks/useClientPagination";

const PAGE_SIZE = 9;
const FALLBACK_COVER = "/images/theme/programming-banner.webp";

export default function EventsPage() {
  const { events } = usePublicData();
  const [registerFor, setRegisterFor] = useState<{
    slug: string;
    title: string;
  } | null>(null);

  const { page, setPage, totalPages, pageItems, hasPagination } = useClientPagination(
    events,
    PAGE_SIZE,
  );

  return (
    <SiteLayout flushTop>
      <PageHero
        eyebrow="Events"
        title="Events & Meetups"
        subtitle="Workshops, hackathons, and alumni get-togethers."
      />
      <section className="relative section-y overflow-hidden bg-brand-lighten-02">
        <span
          className="pointer-events-none absolute -left-16 top-10 h-40 w-40 rounded-full bg-brand-navy/5"
          aria-hidden
        />
        <div className="container-page relative z-[1]">
          {events.length === 0 ? (
            <p className="py-20 text-center text-brand-body">No upcoming events yet.</p>
          ) : (
            <>
              <div className="grid justify-items-stretch gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
                {pageItems.map((e) => {
                  const slug =
                    "slug" in e && e.slug
                      ? String(e.slug)
                      : e.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
                  const cover =
                    "cover" in e && typeof e.cover === "string" && e.cover
                      ? e.cover
                      : FALLBACK_COVER;
                  return (
                    <EventCard
                      key={slug}
                      slug={slug}
                      title={e.title}
                      description={e.description}
                      date={e.date}
                      time={e.time}
                      location={e.location}
                      tag={e.tag}
                      cover={cover}
                      onRegister={() => setRegisterFor({ slug, title: e.title })}
                      className="mx-0 max-w-none"
                    />
                  );
                })}
              </div>
              {hasPagination ? (
                <ListPagination page={page} totalPages={totalPages} onPageChange={setPage} />
              ) : null}
            </>
          )}
        </div>
      </section>

      <EventRegisterDialog
        open={!!registerFor}
        onOpenChange={(open) => !open && setRegisterFor(null)}
        eventSlug={registerFor?.slug || ""}
        eventTitle={registerFor?.title || ""}
      />
    </SiteLayout>
  );
}
