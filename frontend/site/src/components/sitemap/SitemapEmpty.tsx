export function SitemapEmpty({
  hasFilters,
}: {
  hasFilters?: boolean;
}) {
  return (
    <div className="rounded-xl border border-brand-border bg-white px-6 py-12 text-center shadow-brand-soft">
      <p className="font-secondary text-lg font-bold text-[#181818]">
        {hasFilters ? "No matching pages" : "No sitemap pages yet"}
      </p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-brand-body">
        {hasFilters
          ? "Try a different search or section filter."
          : "The sitemap will appear here once pages are published."}
      </p>
    </div>
  );
}
