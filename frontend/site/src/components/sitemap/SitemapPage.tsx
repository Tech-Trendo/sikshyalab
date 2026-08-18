"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Accordion } from "@/components/ui/accordion";
import { SitemapEmpty } from "@/components/sitemap/SitemapEmpty";
import { SitemapError } from "@/components/sitemap/SitemapError";
import { SitemapFilter } from "@/components/sitemap/SitemapFilter";
import { SitemapLoading } from "@/components/sitemap/SitemapLoading";
import { SitemapSearch } from "@/components/sitemap/SitemapSearch";
import { SitemapSection } from "@/components/sitemap/SitemapSection";
import {
  filterSitemapSections,
  groupSitemapSections,
} from "@/components/sitemap/sitemap-utils";
import { fetchSeoSitemapResult, type SitemapApiEntry } from "@/lib/seo";

export function SitemapPage() {
  const [entries, setEntries] = useState<SitemapApiEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [openSections, setOpenSections] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchSeoSitemapResult();
    if (!result.ok) {
      setEntries([]);
      setError(result.error);
      setLoading(false);
      return;
    }
    setEntries(result.entries);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const sections = useMemo(() => groupSitemapSections(entries), [entries]);
  const categoryOptions = useMemo(
    () => sections.map((section) => ({ key: section.key, title: section.title })),
    [sections],
  );
  const visible = useMemo(
    () => filterSitemapSections(sections, query, category),
    [sections, query, category],
  );

  useEffect(() => {
    setOpenSections(visible.map((section) => section.key));
  }, [visible]);

  const hasFilters = query.trim().length > 0 || category !== "all";

  return (
    <section className="section-y bg-brand-lighten-02">
      <div className="container-page">
        {loading ? (
          <SitemapLoading />
        ) : error ? (
          <SitemapError message={error} onRetry={() => void load()} />
        ) : entries.length === 0 ? (
          <SitemapEmpty />
        ) : (
          <>
            <div className="mb-8 grid grid-cols-1 gap-3 rounded-brand-lg bg-white p-4 shadow-brand-soft sm:grid-cols-2 md:p-5">
              <SitemapSearch value={query} onChange={setQuery} />
              <SitemapFilter
                value={category}
                onChange={setCategory}
                options={categoryOptions}
              />
            </div>

            {visible.length === 0 ? (
              <SitemapEmpty hasFilters={hasFilters} />
            ) : (
              <Accordion
                type="multiple"
                value={openSections}
                onValueChange={setOpenSections}
                className="space-y-3"
              >
                {visible.map((section) => (
                  <SitemapSection key={section.key} section={section} />
                ))}
              </Accordion>
            )}
          </>
        )}
      </div>
    </section>
  );
}
