"use client";

import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { SiteLayout, PageHero } from "@/components/layout/SiteLayout";
import { AuthShell } from "@/components/layout/AuthShell";
import { Button } from "@/components/ui/button";

const backToSignInClass =
  "inline-flex h-11 w-full items-center justify-center rounded-full bg-brand-navy px-6 text-sm font-semibold !text-white transition-all duration-300 hover:bg-brand-orange focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy";

export default function PasswordResetSuccessPage() {
  return (
    <SiteLayout flushTop>
      <PageHero
        eyebrow="Account"
        title="Password updated"
        subtitle="Your password has been changed successfully. You can sign in with your new password."
      />
      <AuthShell
        compact
        title="Password updated"
        subtitle="Your password has been changed successfully. You can sign in with your new password."
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-emerald-500/15 text-emerald-700">
            <CheckCircle2 className="h-7 w-7" aria-hidden />
          </span>
          <p className="text-sm text-brand-body">
            If this wasn’t you, contact support immediately.
          </p>
          <Button asChild>
            <Link href="/login" className={backToSignInClass}>
              Back to sign in
            </Link>
          </Button>
        </div>
      </AuthShell>
    </SiteLayout>
  );
}
