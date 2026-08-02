import Link from "next/link";
import { Home, LayoutGrid } from "lucide-react";
import { SiteLayout } from "@/components/layout/SiteLayout";

export default function NotFound() {
  return (
    <SiteLayout flushTop>
      <section className="relative overflow-hidden bg-brand-shade pt-[var(--site-header-height,8.5rem)] sm:pt-[var(--site-header-height,9rem)]">
        <div
          className="pointer-events-none absolute left-6 top-10 hidden opacity-50 md:block"
          aria-hidden
        >
          <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(4, 6px)" }}>
            {Array.from({ length: 16 }).map((_, i) => (
              <span key={i} className="h-1.5 w-1.5 rounded-full bg-brand-orange/50" />
            ))}
          </div>
        </div>
        <div
          className="pointer-events-none absolute -right-10 bottom-0 h-48 w-48 rounded-full border-[14px] border-brand-orange/15"
          aria-hidden
        />

        <div className="container-page relative flex min-h-[60vh] flex-col items-center justify-center py-20 text-center lg:min-h-[70vh] lg:py-28">
          <p className="font-heading text-[13px] font-bold uppercase tracking-[1.5px] text-brand-orange">
            Error 404
          </p>
          <p
            className="mt-3 font-heading text-[7rem] font-bold leading-none tracking-tight text-heading sm:text-[9rem] lg:text-[11rem]"
            aria-hidden
          >
            404
          </p>
          <h1 className="mt-2 font-heading text-2xl font-bold text-heading sm:text-3xl lg:text-4xl">
            Page Not Found
          </h1>
          <p className="mt-4 max-w-md font-body text-[15px] leading-relaxed text-brand-body">
            The page you are looking for might have been removed, had its name changed, or is
            temporarily unavailable.
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/"
              className="inline-flex h-12 items-center gap-2 rounded-full bg-brand-gradient px-7 text-sm font-semibold text-white shadow-brand-soft transition hover:brightness-95"
            >
              <Home className="h-4 w-4" aria-hidden />
              Back to Home
            </Link>
            <Link
              href="/courses"
              className="inline-flex h-12 items-center gap-2 rounded-full border border-brand-border bg-white px-7 text-sm font-semibold text-heading transition hover:border-brand-orange hover:text-brand-orange"
            >
              <LayoutGrid className="h-4 w-4" aria-hidden />
              Browse Courses
            </Link>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
