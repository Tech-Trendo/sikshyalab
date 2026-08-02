"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Clock, MapPin, ArrowLeft } from "lucide-react";
import { SiteLayout, PageHero } from "@/components/layout/SiteLayout";
import { EventRegistrationForm } from "@/components/events/EventRegistrationForm";
import { fetchPublicEvent } from "@/lib/public-api";

export default function EventDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);

  const { data: event, isLoading } = useQuery({
    queryKey: ["public", "event", slug],
    queryFn: () => fetchPublicEvent(slug),
  });

  if (isLoading) {
    return (
      <SiteLayout>
        <div className="section-y container-page text-brand-body">Loading event…</div>
      </SiteLayout>
    );
  }

  if (!event) {
    return (
      <SiteLayout flushTop>
        <PageHero eyebrow="Events" title="Event not found" subtitle="This event may have been removed." />
        <section className="section-y bg-brand-lighten-02">
          <div className="container-page">
            <Link href="/events" className="sl-hero-btn inline-flex !h-11 !min-h-11 !px-6 !text-sm">
              Back to events
            </Link>
          </div>
        </section>
      </SiteLayout>
    );
  }

  const dateLabel = new Date(event.start_datetime).toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
  const timeLabel = new Date(event.start_datetime).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <SiteLayout flushTop>
      <PageHero
        eyebrow="Events"
        title={event.title}
        subtitle="Register below — details are emailed after approval."
      />
      <section className="section-y bg-brand-lighten-02">
        <div className="container-page grid gap-8 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <Link
              href="/events"
              className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-brand-navy hover:text-brand-orange"
            >
              <ArrowLeft className="h-4 w-4" /> Back to events
            </Link>
            <article className="card-brand p-6 sm:p-8">
              <div className="flex flex-wrap gap-4 text-sm text-brand-body">
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-brand-navy" /> {dateLabel}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-brand-navy" /> {timeLabel}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-brand-navy" /> {event.location}
                </span>
              </div>
              <div className="mt-6 space-y-4 text-[15px] leading-relaxed text-brand-body">
                {(event.description || "Join us for this ShikshaLab event.")
                  .split(/\n+/)
                  .map((para) => (
                    <p key={para.slice(0, 24)}>{para}</p>
                  ))}
              </div>
            </article>
          </div>

          <div className="lg:col-span-2">
            <div className="card-brand sticky top-28 bg-white p-6 sm:p-8">
              <h2 className="font-heading text-xl font-bold text-brand-navy-dark">
                Register for this event
              </h2>
              <p className="mt-2 text-sm text-brand-body">
                Fill out the form. After admin approval, event details will be
                sent to your email.
              </p>
              <div className="mt-6">
                <EventRegistrationForm
                  eventSlug={event.slug}
                  eventTitle={event.title}
                  idPrefix="detail-event-reg"
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
