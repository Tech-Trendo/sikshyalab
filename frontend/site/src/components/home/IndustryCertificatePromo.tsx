"use client";

import Link from "next/link";
import RevealOnScroll, { THEME_DELAY } from "@/components/motion/RevealOnScroll";
import { CertificatePreview } from "@/components/certificates/CertificatePreview";

type Props = {
  courseTitle?: string;
  className?: string;
};

/**
 * Industry certificate promo — shared layout with the home verify banner (two-column, image + copy).
 * Used on course detail pages above related courses.
 */
export function IndustryCertificatePromo({ courseTitle, className }: Props) {
  const sampleCourse = courseTitle?.trim() || "Professional Training Program";

  return (
    <section
      className={className}
      aria-labelledby="industry-certificate-heading"
    >
      <div className="relative grid items-center gap-8 rounded-brand-lg bg-brand-lighten-02 p-6 shadow-brand-soft sm:p-8 lg:grid-cols-2 lg:gap-10">
        <RevealOnScroll variant="slide-right" delay={THEME_DELAY.slideRight} className="relative mx-auto w-full max-w-[320px]">
          <div className="overflow-hidden rounded-xl shadow-[0_18px_48px_rgba(27,58,107,0.14)]">
            <CertificatePreview
              size="sm"
              data={{
                studentName: "Your Name",
                courseName: sampleCourse,
                certificateNumber: "SL-2026-0001",
                issueDate: "January 2026",
                instituteName: "ShikshaLab",
                certificateType: "Certificate of Completion",
              }}
            />
          </div>
        </RevealOnScroll>

        <RevealOnScroll variant="slide-left" delay={THEME_DELAY.media} className="text-center lg:text-left">
          <p className="mb-2 font-body text-xs font-semibold uppercase tracking-[1.5px] text-brand-orange">
            Industry certification
          </p>
          <h2
            id="industry-certificate-heading"
            className="font-heading text-[26px] font-bold leading-snug text-[#181818] sm:text-[34px]"
          >
            Earn a High Value{" "}
            <span className="text-brand-navy">Industry Certificate</span>
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[#181818] sm:text-base">
            Complete this course and receive an industry-recognized certification you can
            add to LinkedIn, your resume, and your CV. Each credential is a verifiable
            certificate of completion employers and recruiters can trust.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-[#181818] sm:text-base">
            Use your globally recognized certificate of completion to demonstrate
            job-ready skills with a credential backed by ShikshaLab verification.
          </p>
          <p className="mt-6 text-sm text-[#181818]">
            Already earned a certificate?{" "}
            <Link
              href="/verify"
              className="font-semibold text-brand-navy underline-offset-2 transition-colors hover:text-brand-orange hover:underline"
            >
              Verify it here
            </Link>
          </p>
        </RevealOnScroll>
      </div>
    </section>
  );
}

/** @deprecated Use IndustryCertificatePromo */
export const CertificatePromoSection = IndustryCertificatePromo;
