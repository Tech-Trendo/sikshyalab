"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import { SiteLayout, PageHero } from "@/components/layout/SiteLayout";
import { AuthShell, authButtonClass, authInputClass } from "@/components/layout/AuthShell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { apiResendPasswordOtp, apiVerifyPasswordOtp } from "@/lib/api";
import { cn } from "@/lib/utils";

function VerifyOtpForm() {
  const params = useSearchParams();
  const router = useRouter();
  const requestId = params.get("request_id") || "";
  const initialExpires = Number(params.get("expires") || 600);
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(initialExpires);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [secondsLeft]);

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestId) {
      toast.error("Missing reset session. Start again from forgot password.");
      return;
    }
    if (!/^\d{6}$/.test(otp.trim())) {
      toast.error("Enter the 6-digit code");
      return;
    }
    setBusy(true);
    const result = await apiVerifyPasswordOtp(requestId, otp.trim());
    setBusy(false);
    if (!result.ok || !result.reset_token) {
      toast.error(result.detail || "Invalid or expired code");
      return;
    }
    toast.success("Verified");
    router.push(`/forgot-password/reset?token=${encodeURIComponent(result.reset_token)}`);
  };

  const onResend = async () => {
    if (!requestId || secondsLeft > 0) return;
    setResendBusy(true);
    const result = await apiResendPasswordOtp(requestId);
    setResendBusy(false);
    if (!result.ok) {
      toast.error(result.detail || "Could not resend code");
      return;
    }
    setSecondsLeft(result.expires_in_seconds || 600);
    setOtp("");
    toast.success("If an account exists, a new code has been sent.");
  };

  return (
    <AuthShell
      compact
      title="Enter verification code"
      subtitle="We sent a 6-digit code. It expires soon — don’t share it with anyone."
    >
      {!requestId ? (
        <p className="text-center text-sm text-red-600">
          Session missing.{" "}
          <Link href="/forgot-password" className="font-semibold text-brand-orange underline">
            Request a new code
          </Link>
          .
        </p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="otp" className="text-brand-navy">
              Verification code
            </Label>
            <Input
              id="otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              required
              className={cn(authInputClass, "tracking-[0.4em] text-center text-lg")}
              aria-describedby="otp-timer"
            />
            <p id="otp-timer" className="text-center text-xs text-brand-body" aria-live="polite">
              {secondsLeft > 0 ? (
                <>
                  Code expires in{" "}
                  <span className="font-semibold text-brand-navy">
                    {mm}:{ss}
                  </span>
                </>
              ) : (
                <span className="text-amber-700">Code expired — you can resend.</span>
              )}
            </p>
          </div>
          <Button type="submit" className={cn(authButtonClass)} disabled={busy}>
            {busy ? "Verifying…" : "Verify code"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full rounded-full"
            disabled={resendBusy || secondsLeft > 0}
            onClick={() => void onResend()}
          >
            {resendBusy ? "Sending…" : secondsLeft > 0 ? `Resend in ${mm}:${ss}` : "Resend code"}
          </Button>
          <p className="text-center text-sm">
            <Link href="/forgot-password" className="text-brand-orange underline">
              Use a different email or phone
            </Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}

export default function VerifyOtpPage() {
  return (
    <SiteLayout flushTop>
      <PageHero
        eyebrow="Account"
        title="Enter verification code"
        subtitle="We sent a 6-digit code. It expires soon — don’t share it with anyone."
      />
      <Suspense fallback={<div className="py-24 text-center text-sm text-brand-body">Loading…</div>}>
        <VerifyOtpForm />
      </Suspense>
    </SiteLayout>
  );
}
