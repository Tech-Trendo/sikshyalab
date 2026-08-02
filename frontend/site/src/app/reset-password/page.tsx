"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useEffect } from "react";
import { SiteLayout, PageHero } from "@/components/layout/SiteLayout";
import { AuthShell } from "@/components/layout/AuthShell";

/** Legacy email-link entry: forward token into the OTP reset password page. */
function LegacyResetRedirect() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") || "";

  useEffect(() => {
    if (token) {
      router.replace(`/forgot-password/reset?token=${encodeURIComponent(token)}`);
    }
  }, [token, router]);

  if (!token) {
    return (
      <AuthShell
        compact
        title="Reset password"
        subtitle="Use the forgot password flow to get a verification code."
      >
        <p className="text-center text-sm text-brand-body">
          <Link href="/forgot-password" className="font-semibold text-brand-orange underline">
            Forgot password
          </Link>
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell compact title="Reset password" subtitle="Redirecting…">
      <p className="text-center text-sm text-brand-body">Please wait…</p>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <SiteLayout flushTop>
      <PageHero
        eyebrow="Account"
        title="Reset password"
        subtitle="Use the forgot password flow to get a verification code."
      />
      <Suspense fallback={<div className="py-24 text-center text-sm text-brand-body">Loading…</div>}>
        <LegacyResetRedirect />
      </Suspense>
    </SiteLayout>
  );
}
