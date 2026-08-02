"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { SiteLayout, PageHero } from "@/components/layout/SiteLayout";
import { AuthShell, authButtonClass, authInputClass } from "@/components/layout/AuthShell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { apiResetPassword } from "@/lib/api";
import { cn } from "@/lib/utils";

function strength(password: string) {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  const labels = ["Too weak", "Weak", "Fair", "Good", "Strong"];
  return { score, label: labels[Math.max(0, score - 1)] || "Too weak" };
}

function ResetForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const meter = useMemo(() => strength(password), [password]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      toast.error("Missing reset token. Verify your code again.");
      return;
    }
    if (meter.score < 5) {
      toast.error("Use 8+ chars with upper, lower, number, and special character");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setBusy(true);
    const result = await apiResetPassword(token, password, confirm);
    setBusy(false);
    if (!result.ok) {
      toast.error(result.detail || "Could not reset password");
      return;
    }
    router.push("/forgot-password/success");
  };

  return (
    <AuthShell compact title="Set new password" subtitle="Choose a strong password you haven’t used before.">
      {!token ? (
        <p className="text-center text-sm text-red-600">
          Invalid session.{" "}
          <Link href="/forgot-password" className="font-semibold text-brand-orange underline">
            Start over
          </Link>
          .
        </p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password" className="text-brand-navy">
              New password
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={show ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className={cn(authInputClass, "pr-11")}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-body"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? "Hide password" : "Show password"}
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <div className="space-y-1" aria-live="polite">
              <div className="flex gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <span
                    key={i}
                    className={cn(
                      "h-1.5 flex-1 rounded-full",
                      i < meter.score ? "bg-brand-orange" : "bg-muted",
                    )}
                  />
                ))}
              </div>
              <p className="text-xs text-brand-body">Strength: {meter.label}</p>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm" className="text-brand-navy">
              Confirm password
            </Label>
            <Input
              id="confirm"
              type={show ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              className={authInputClass}
              autoComplete="new-password"
            />
          </div>
          <Button type="submit" className={cn(authButtonClass)} disabled={busy}>
            {busy ? "Saving…" : "Update password"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}

export default function ForgotResetPage() {
  return (
    <SiteLayout flushTop>
      <PageHero
        eyebrow="Account"
        title="Set new password"
        subtitle="Choose a strong password you haven’t used before."
      />
      <Suspense fallback={<div className="py-24 text-center text-sm text-brand-body">Loading…</div>}>
        <ResetForm />
      </Suspense>
    </SiteLayout>
  );
}
