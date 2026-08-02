"use client";

import { SiteLayout } from "@/components/layout/SiteLayout";
import { AboutPageHeader } from "@/components/about/AboutPageHeader";
import { AboutWhyChoose } from "@/components/about/AboutWhyChoose";
import { AboutStats } from "@/components/about/AboutStats";
import { About } from "@/components/home/About";
import { PartnersStrip } from "@/components/home/PartnersStrip";
import { usePublicData } from "@/hooks/usePublicData";

export default function AboutPage() {
  const { aboutPage } = usePublicData();
  const image = aboutPage?.featured_image || "/images/theme/about-26.webp";

  return (
    <SiteLayout flushTop>
      <AboutPageHeader
        title={aboutPage?.title || "About ShikshaLab"}
        backgroundImage={image}
      />
      <About showCta={false} />
      <AboutWhyChoose />
      <PartnersStrip />
      <AboutStats />
    </SiteLayout>
  );
}
