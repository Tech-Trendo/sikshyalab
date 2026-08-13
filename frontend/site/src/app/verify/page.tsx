"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { SiteLayout, PageHero } from "@/components/layout/SiteLayout";
import { Section, SectionContainer } from "@/components/brand/Section";
import { CertificateCanvasPreview } from "@/components/certificates/CertificateGenerator";
import { verifyPublicCertificate } from "@/lib/public-api";
import { toCanvasData } from "@/lib/certificate-canvas";
import { CheckCircle2, GraduationCap, XCircle } from "lucide-react";
import RevealOnScroll, { THEME_DELAY } from "@/components/motion/RevealOnScroll";
import { useMouseParallax } from "@/hooks/useMouseParallax";
import { cn } from "@/lib/utils";

type VerifyResult = {
  code: string;
  student: string;
  course: string;
  issued: string;
  status: string;
  supervisorName?: string;
};

function VerifyInner() {
  const searchParams = useSearchParams();
  const initialCode = searchParams.get("code") || "";
  const [code, setCode] = useState(initialCode);
  const [result, setResult] = useState<null | VerifyResult | "invalid">(null);
  const [checking, setChecking] = useState(false);
  const autoRan = useRef(false);
  const containerRef = useMouseParallax(20);

  const runVerify = useCallback(async (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    setChecking(true);
    try {
      const api = await verifyPublicCertificate(trimmed);
      if (api && api.is_valid !== false && (api.status || "").toUpperCase() !== "REVOKED") {
        setResult({
          code: api.certificate_number || api.verification_code || trimmed,
          student: api.student_name || "—",
          course: api.course_title || "—",
          issued: api.issue_date || new Date().toISOString().slice(0, 10),
          status: "Valid",
          supervisorName: api.instructor_name || undefined,
        });
        return;
      }
      setResult("invalid");
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    if (autoRan.current || !initialCode.trim()) return;
    autoRan.current = true;
    void runVerify(initialCode);
  }, [initialCode, runVerify]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await runVerify(code);
  };

  return (
    <SiteLayout flushTop>
      <PageHero
        eyebrow="Verify"
        title="Certificate Verification"
        subtitle="Enter a certificate code to instantly verify its authenticity."
      />
      <Section muted className="!py-12 lg:!py-14">
        <SectionContainer>
          <div
            ref={containerRef}
            className="relative grid items-center gap-8 lg:grid-cols-2 lg:gap-10"
          >
            <RevealOnScroll
              variant="slide-right"
              delay={THEME_DELAY.slideRight}
              className="relative mx-auto max-w-[300px]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/theme/shape-05.png"
                alt=""
                data-depth="1"
                className="pointer-events-none absolute -left-8 top-6 hidden h-auto w-8 opacity-70 transition-transform duration-300 ease-out lg:block"
                draggable={false}
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/theme/shape-31.png"
                alt=""
                data-depth="-0.8"
                className="pointer-events-none absolute -right-6 bottom-10 hidden h-auto w-10 opacity-70 transition-transform duration-300 ease-out lg:block"
                draggable={false}
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/theme/cta-programming-img.webp"
                alt="Verify ShikshaLab certificate"
                className="sl-float-y-sm relative z-[1] h-auto w-full"
                draggable={false}
              />
            </RevealOnScroll>

            <RevealOnScroll
              variant="slide-left"
              delay={THEME_DELAY.media}
              className="text-center lg:text-left"
            >
              <p className="mb-2 font-body text-xs font-semibold uppercase tracking-[1.5px] text-brand-orange">
                Verify Certificate
              </p>
              <h2 className="font-heading text-[26px] font-bold leading-snug text-[#181818] sm:text-[34px]">
                Confirm Your{" "}
                <span className="text-brand-navy">ShikshaLab Certificate</span>{" "}
                Instantly
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-brand-body sm:text-base">
                Enter the certificate code to check authenticity on our public
                verification page.
              </p>

              <form
                onSubmit={submit}
                className="mt-7 flex w-full flex-col gap-3 md:flex-row md:items-center"
              >
                <label htmlFor="verify-code" className="sr-only">
                  Certificate code
                </label>
                <input
                  id="verify-code"
                  name="certificate_code"
                  type="text"
                  autoComplete="off"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder=""
                  className="h-[50px] w-full min-w-0 flex-1 rounded-[5px] border border-brand-border bg-white px-4 text-sm text-brand-navy-dark outline-none transition focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/20"
                />
                <button
                  type="submit"
                  disabled={checking}
                  className="sl-hero-btn w-full !h-[50px] !min-h-12 shrink-0 !px-8 md:w-auto disabled:opacity-70"
                >
                  {checking ? "Verifying…" : "Verify certificate"}
                </button>
              </form>
            </RevealOnScroll>
          </div>

          {result === "invalid" && (
            <div className="mx-auto mt-10 flex max-w-2xl items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-6">
              <XCircle className="h-6 w-6 shrink-0 text-red-600" />
              <div>
                <p className="font-semibold text-red-700">Certificate not found</p>
                <p className="text-sm text-brand-body">Please check the code and try again.</p>
              </div>
            </div>
          )}

          {result && result !== "invalid" && (
            <div className="mx-auto mt-10 max-w-3xl space-y-4">
              <div className="flex items-center justify-between">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-navy text-white">
                  <GraduationCap className="h-5 w-5" />
                </span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold",
                    result.status === "Valid"
                      ? "bg-brand-lighten-01 text-brand-navy"
                      : "bg-red-100 text-red-700",
                  )}
                >
                  {result.status === "Valid" ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Valid
                    </>
                  ) : (
                    result.status
                  )}
                </span>
              </div>
              <CertificateCanvasPreview
                data={toCanvasData({
                  recipientName: result.student,
                  courseName: result.course,
                  certificateNumber: result.code,
                  issueDate: result.issued,
                  supervisorName: result.supervisorName,
                })}
              />
            </div>
          )}
        </SectionContainer>
      </Section>
    </SiteLayout>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<div className="py-24 text-center text-brand-body">Loading…</div>}>
      <VerifyInner />
    </Suspense>
  );
}
