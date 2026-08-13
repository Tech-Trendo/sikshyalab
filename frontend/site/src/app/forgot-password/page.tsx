"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";
import { SiteLayout, PageHero } from "@/components/layout/SiteLayout";
import { AuthShell, authButtonClass, authInputClass } from "@/components/layout/AuthShell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { apiForgotPassword } from "@/lib/api";
import { cn } from "@/lib/utils";

const backToSignInClass =
  "inline-flex h-11 w-full items-center justify-center rounded-full bg-brand-navy px-6 text-sm font-semibold !text-white transition-all duration-300 hover:bg-brand-orange focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy";

function ForgotPasswordForm() {
  const params = useSearchParams();
  const router = useRouter();
  const [identifier, setIdentifier] = useState(params.get("email") || params.get("phone") || "");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = identifier.trim();
    if (!value) {
      toast.error("Enter your email or registered phone number");
      return;
    }
    setBusy(true);
    try {
      const result = await apiForgotPassword(value);
      if (!result.ok) {
        toast.error(result.detail || "Could not start password reset");
        return;
      }
      toast.success("Check your inbox", {
        description:
          result.detail ||
          "If an account exists with the provided information, a verification code has been sent.",
      });
      if (result.request_id) {
        const qs = new URLSearchParams({
          request_id: result.request_id,
          expires: String(result.expires_in_seconds || 600),
          channel: result.channel || "EMAIL",
        });
        router.push(`/forgot-password/verify?${qs.toString()}`);
      }
    } catch {
      toast.error("Could not send verification code");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      compact
      title="Forgot password"
      subtitle="Enter your email or registered phone. We’ll send a verification code if an account exists."
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="identifier" className="text-brand-navy">
            Email or phone
          </Label>
          <Input
            id="identifier"
            name="username"
            type="text"
            autoComplete="username"
            inputMode="email"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
            placeholder="you@example.com or 98xxxxxxxx"
            className={authInputClass}
            aria-describedby="identifier-hint"
          />
          <p id="identifier-hint" className="text-xs text-brand-body">
            For your security, we won’t say whether the account exists.
          </p>
        </div>
        <Button type="submit" className={cn(authButtonClass)} disabled={busy}>
          {busy ? "Sending…" : "Send verification code"}
        </Button>
        <p className="text-center">
          <Link href="/login" className={backToSignInClass}>
            Back to sign in
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}

export default function ForgotPasswordPage() {
  return (
    <SiteLayout flushTop>
      <PageHero
        eyebrow="Account"
        title="Forgot password"
        subtitle="Enter your email or registered phone. We’ll send a verification code if an account exists."
      />
      <Suspense fallback={<div className="py-24 text-center text-sm text-brand-body">Loading…</div>}>
        <ForgotPasswordForm />
      </Suspense>
    </SiteLayout>
  );
}
