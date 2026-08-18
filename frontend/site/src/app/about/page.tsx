"use client";

import { SiteLayout, PageHero } from "@/components/layout/SiteLayout";
import { About } from "@/components/home/About";
import { AboutPillars } from "@/components/about/AboutPillars";
import { AboutWhyChoose } from "@/components/about/AboutWhyChoose";
import { AboutLifeAt } from "@/components/about/AboutLifeAt";
import { PartnersStrip } from "@/components/home/PartnersStrip";
import { usePublicData } from "@/hooks/usePublicData";
import { parseAboutCms } from "@/lib/about-cms";
import { resolveMediaUrl } from "@/lib/env";

export default function AboutPage() {
  const { aboutPage, gallery } = usePublicData();
  const cms = parseAboutCms(aboutPage?.content);
  const lifeImage =
    resolveMediaUrl(cms.lifeAt.image) || cms.lifeAt.image || gallery[0]?.image;

  return (
    <SiteLayout flushTop>
      <PageHero
        eyebrow="About"
        title={cms.heroTitle || aboutPage?.title || "About ShikshaLab"}
        breadcrumbLabel={cms.heroBreadcrumb || "About Us"}
      />
      <About showCta={false} />
      <AboutPillars items={cms.pillars} />
      <AboutWhyChoose items={cms.whyChoose} />
      <PartnersStrip heading={cms.partnersHeading || "Our Hiring Partners"} />
      <AboutLifeAt
        heading={cms.lifeAt.heading}
        description={cms.lifeAt.description}
        image={lifeImage}
      />
    </SiteLayout>
  );
}
