"use client";

import { AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { SitemapItem } from "@/components/sitemap/SitemapItem";
import type { SitemapSectionData } from "@/components/sitemap/sitemap-utils";

export function SitemapSection({ section }: { section: SitemapSectionData }) {
  return (
    <AccordionItem
      value={section.key}
      className="overflow-hidden rounded-xl border border-brand-border/70 border-b-0 bg-white px-4 shadow-brand-soft sm:px-5"
    >
      <AccordionTrigger className="py-4 text-base font-bold text-[#181818] hover:no-underline">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate">{section.title}</span>
          <span className="shrink-0 text-xs font-semibold text-brand-body">
            {section.count} {section.count === 1 ? "page" : "pages"}
          </span>
        </span>
      </AccordionTrigger>
      <AccordionContent className="pb-4">
        <ul className="space-y-0.5" aria-label={`${section.title} pages`}>
          {section.nodes.map((node) => (
            <SitemapItem key={node.path} node={node} />
          ))}
        </ul>
      </AccordionContent>
    </AccordionItem>
  );
}
