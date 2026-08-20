import { Skeleton } from "@/components/ui/skeleton";
import { SectionContainer } from "@/components/brand/Section";

/** Skeleton layout for the blog article detail page while the post is loading. */
export function BlogDetailLoading() {
  return (
    <section className="section-y bg-brand-lighten-02" aria-busy="true" aria-live="polite">
      <SectionContainer>
        <div className="space-y-6">
          <span className="sr-only">Loading article…</span>
          <Skeleton className="h-9 w-4/5 max-w-2xl rounded-brand sm:h-10" />
          <Skeleton className="aspect-video w-full rounded-brand-lg" />
          <div className="space-y-3">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
          </div>
          <div className="space-y-3 pt-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
          <Skeleton className="h-4 w-28" />
        </div>
      </SectionContainer>
    </section>
  );
}
