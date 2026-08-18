import { Skeleton } from "@/components/ui/skeleton";

export function SitemapLoading() {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="space-y-4">
      <span className="sr-only">Loading sitemap…</span>
      <div className="grid grid-cols-1 gap-3 rounded-brand-lg bg-white p-4 shadow-brand-soft sm:grid-cols-2 md:p-5">
        <Skeleton className="h-11 w-full rounded-brand" />
        <Skeleton className="h-11 w-full rounded-brand" />
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-xl border border-brand-border/70 bg-white p-5 shadow-brand-soft"
        >
          <Skeleton className="h-5 w-40" />
          <div className="mt-4 space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
