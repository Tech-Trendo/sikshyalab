import Link from "next/link";
import { SiteLayout, PageHero } from "@/components/layout/SiteLayout";
import { getDashboardUrl } from "@/lib/env";

export default function Page() {
  const dashboardUrl = getDashboardUrl().replace(/\/$/, "") || "http://localhost:5173";

  return (
    <SiteLayout flushTop>
      <PageHero
        eyebrow="Portal"
        title="Teacher Portal"
        subtitle="Manage batches, review submissions, and mentor students from the dashboard."
      />
      <section className="bg-brand-lighten-02 py-16">
        <div className="mx-auto max-w-lg px-4 text-center sm:px-6 lg:px-8">
          <div className="rounded-2xl bg-white p-8 shadow-[0_18px_50px_-24px_rgba(11,26,59,0.28)] ring-1 ring-black/[0.04]">
            <p className="text-[15px] leading-relaxed text-brand-body">
              Sign in with your teacher account. After authentication you will be taken to the
              ShikshaLab dashboard.
            </p>
            <Link
              href="/login"
              className="mt-6 inline-flex h-12 items-center rounded-full bg-brand-gradient px-8 text-[15px] font-semibold !text-white transition-colors hover:brightness-105"
            >
              Sign in to portal
            </Link>
            <p className="mt-4 text-xs text-brand-body">
              Already signed in?{" "}
              <a
                href={`${dashboardUrl}/dashboard`}
                className="font-semibold text-brand-orange hover:underline"
              >
                Open dashboard
              </a>
            </p>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
