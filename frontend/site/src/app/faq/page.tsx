"use client";

import { FaqBlock } from "@/components/brand/FaqBlock";
import { SiteLayout, PageHero } from "@/components/layout/SiteLayout";
import { usePublicData } from "@/hooks/usePublicData";

export default function FaqPage() {
  const { faqGroups, faqTabs, settings } = usePublicData();

  return (
    <SiteLayout flushTop>
      <PageHero
        eyebrow="FAQ"
        title="Frequently Asked Questions"
        subtitle={settings?.tagline || "Answers to common questions about learning at ShikshaLab."}
      />
      <FaqBlock
        showTabs
        showLogos={false}
        faqGroups={faqGroups}
        tabs={faqTabs.length ? faqTabs : undefined}
        description={undefined}
      />
    </SiteLayout>
  );
}
