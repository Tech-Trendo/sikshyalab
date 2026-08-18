"use client";

import { SiteLayout, PageHero } from "@/components/layout/SiteLayout";
import { SitemapPage } from "@/components/sitemap/SitemapPage";

export default function HtmlSitemapRoute() {
  return (
    <SiteLayout flushTop>
      <PageHero
        eyebrow="Sitemap"
        title="Website Sitemap"
        subtitle="Browse every public page on this site, grouped by the structure returned from the sitemap API."
      />
      <SitemapPage />
    </SiteLayout>
  );
}
