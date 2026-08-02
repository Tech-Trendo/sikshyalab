"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { SiteLayout, PageHero } from "@/components/layout/SiteLayout";
import { getDashboardUrl } from "@/lib/env";

function StudentPortalInner() {
  const searchParams = useSearchParams();
  const assignment = searchParams.get("assignment") || undefined;
  const dashboardUrl = getDashboardUrl().replace(/\/$/, "") || "http://localhost:5173";
  const assignmentsHref = `${dashboardUrl}/dashboard/assignments`;

  return (
    <SiteLayout flushTop>
      <PageHero
        eyebrow="Portal"
        title="Student Portal"
        subtitle="Continue where you left off. Track progress, submit assignments and download certificates."
      />
      <section className="bg-brand-lighten-02 py-16">
        <div className="mx-auto max-w-lg px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl bg-white p-8 text-center shadow-[0_18px_50px_-24px_rgba(11,26,59,0.28)] ring-1 ring-black/[0.04]">
            {assignment ? (
              <>
                <p className="text-xs font-semibold uppercase tracking-widest text-brand-orange">
                  Assignment
                </p>
                <h2 className="mt-1 font-secondary text-xl font-bold text-brand-navy">{assignment}</h2>
                <p className="mt-4 text-[15px] leading-relaxed text-brand-body">
                  Submit this assignment from your dashboard after signing in.
                </p>
                <a
                  href={assignmentsHref}
                  className="mt-6 inline-flex h-12 items-center rounded-full bg-brand-gradient px-8 text-[15px] font-semibold !text-white transition-colors hover:brightness-105"
                >
                  Open in dashboard
                </a>
              </>
            ) : (
              <>
                <p className="text-[15px] leading-relaxed text-brand-body">
                  Sign in to open your learner dashboard — courses, fees, certificates, and more.
                </p>
                <Link
                  href="/login"
                  className="mt-6 inline-flex h-12 items-center rounded-full bg-brand-gradient px-8 text-[15px] font-semibold !text-white transition-colors hover:brightness-105"
                >
                  Sign in to portal
                </Link>
              </>
            )}
            <p className="mt-4 text-xs text-brand-body">
              Or go directly to{" "}
              <a
                href={`${dashboardUrl}/dashboard`}
                className="font-semibold text-brand-orange hover:underline"
              >
                the dashboard
              </a>
              .
            </p>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}

export default function StudentPortalPage() {
  return (
    <Suspense fallback={<div className="py-24 text-center text-brand-body">Loading…</div>}>
      <StudentPortalInner />
    </Suspense>
  );
}
