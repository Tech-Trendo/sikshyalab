"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { Section, SectionContainer, SectionHeading } from "@/components/brand/Section";
import RevealOnScroll, {
  THEME_DELAY,
  RevealStagger,
  staggerItem,
} from "@/components/motion/RevealOnScroll";
import { EventCard } from "@/components/events/EventCard";
import { EventRegisterDialog } from "@/components/events/EventRegisterDialog";
import { usePublicData } from "@/hooks/usePublicData";
import { isEventOver } from "@/lib/event-time";

/** Home events — newest 3 from the API. */
export function HomeEvents() {
  const { events, loading } = usePublicData();
  const list = events.slice(0, 3);
  const [registerFor, setRegisterFor] = useState<{ slug: string; title: string } | null>(null);

  if (!loading && list.length === 0) return null;

  return (
    <Section>
      <SectionContainer>
        <SectionHeading
          align="center"
          eyebrow="Upcoming Events"
          heading="Join Workshops & Meetups"
          className="sl-section-head"
        />

        <RevealStagger className="grid auto-rows-fr justify-items-stretch gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
          {list.map((e) => (
            <motion.div key={e.slug} variants={staggerItem} className="flex h-full w-full">
              <EventCard
                slug={e.slug}
                title={e.title}
                description={e.description}
                date={e.date}
                time={e.time}
                location={e.location}
                cover={e.cover}
                registrationClosed={isEventOver(e.startsAt, e.endsAt)}
                onRegister={() => {
                  if (isEventOver(e.startsAt, e.endsAt)) return;
                  setRegisterFor({ slug: e.slug, title: e.title });
                }}
                className="mx-0 max-w-none"
              />
            </motion.div>
          ))}
        </RevealStagger>

        {events.length > 3 ? (
          <RevealOnScroll variant="fade-up" delay={THEME_DELAY.media} className="mt-8 text-center">
            <Link
              href="/events"
              className="sl-view-more-btn group inline-flex w-full max-w-xs sm:w-auto"
            >
              View all events
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </RevealOnScroll>
        ) : null}
      </SectionContainer>

      <EventRegisterDialog
        open={!!registerFor}
        onOpenChange={(open) => !open && setRegisterFor(null)}
        eventSlug={registerFor?.slug || ""}
        eventTitle={registerFor?.title || ""}
      />
    </Section>
  );
}
