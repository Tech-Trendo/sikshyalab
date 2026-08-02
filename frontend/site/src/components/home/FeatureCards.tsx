"use client";

import { Section, SectionContainer, SectionHeading } from "@/components/brand/Section";
import { DynamicHeading } from "@/components/brand/DynamicHeading";
import RevealOnScroll, {
  THEME_DELAY,
  RevealStagger,
} from "@/components/motion/RevealOnScroll";
import { usePublicData } from "@/hooks/usePublicData";
import { FeatureCard } from "@/components/home/FeatureCard";
import { ContactStrip } from "@/components/home/ContactStrip";

/** Feature cards — CMS-editable via Site settings homepage_features. */
export function FeatureCards() {
  const { contact, settings } = usePublicData();
  const features = settings?.homepage_features?.length ? settings.homepage_features : [];
  if (!features.length) return null;

  const eyebrow = settings?.features_eyebrow?.trim() || "";
  const heading = settings?.features_heading?.trim() || "";

  return (
    <Section>
      <SectionContainer>
        <SectionHeading
          align="center"
          eyebrow={eyebrow}
          heading={heading ? <DynamicHeading text={heading} as="span" /> : null}
          className="sl-section-head mx-auto max-w-2xl [&_.sl-section-title]:text-brand-orange"
        />

        <RevealStagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">
          {features.map((f) => (
            <FeatureCard key={f.title} feature={f} />
          ))}
        </RevealStagger>

        <RevealOnScroll variant="fade-in" delay={THEME_DELAY.media} className="mt-8 lg:mt-10">
          <ContactStrip email={contact.email} phone={contact.phone} />
        </RevealOnScroll>
      </SectionContainer>
    </Section>
  );
}
