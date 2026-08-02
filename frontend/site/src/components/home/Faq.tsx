"use client";

import { FaqBlock } from "@/components/brand/FaqBlock";
import { usePublicData } from "@/hooks/usePublicData";

export function Faq() {
  const { faqGroups, faqTabs, settings } = usePublicData();

  return (
    <FaqBlock
      faqGroups={faqGroups}
      tabs={faqTabs.length ? faqTabs : undefined}
      description={settings?.tagline || undefined}
    />
  );
}
