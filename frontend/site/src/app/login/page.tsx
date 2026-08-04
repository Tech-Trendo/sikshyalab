"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { AuthShell, authButtonClass, authInputClass } from "@/components/layout/AuthShell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth, type AuthUser } from "@/components/dashboard/AuthContext";
import { dashboardPathForRole, rememberEmailRole } from "@/lib/auth-routes";
import { getAccessToken, createLoginHandoff } from "@/lib/api";
import { DEACTIVATED_ACCOUNT_MESSAGE } from "@/lib/account-deactivated";
import { getDashboardUrl } from "@/lib/env";
import { cn } from "@/lib/utils";

async function goToDashboard(user: AuthUser) {
  const dash = getDashboardUrl().replace(/\/$/, "") || "http://localhost:5173";
  const path = user.mustChangePassword
    ? "/change-password"
    : dashboardPathForRole(user.role);

  rememberEmailRole(user.email, user.role);

  const qs = new URLSearchParams();
  qs.set("role", user.role);
  qs.set("email", user.email);
  qs.set("name", user.name || user.email);
  qs.set("path", path);
  if (user.mustChangePassword) qs.set("must_change", "1");

  const access = getAccessToken();
  const refresh =
    typeof window !== "undefined" ? localStorage.getItem("shikshalab_refresh_token") : null;
  if (!access) throw new Error("No access token");

  // Prefer short handoff code; always include hash tokens as backup so dashboard
  // can finish sign-in even if consume hangs (e.g. broken Vite /api proxy).
  const code = await createLoginHandoff();
  if (code) qs.set("code", code);

  const hash = new URLSearchParams();
  hash.set("access", access);
  if (refresh) hash.set("refresh", refresh);
  window.location.href = `${dash}/auth/callback?${qs.toString()}#${hash.toString()}`;
}

function Login() {
  const { signIn: signInUser } = useAuth();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (searchParams.get("deactivated") === "1") {
      toast.error(DEACTIVATED_ACCOUNT_MESSAGE);
      // Drop the query flag so refresh doesn't re-toast
      const url = new URL(window.location.href);
      url.searchParams.delete("deactivated");
      window.history.replaceState({}, "", url.pathname + url.search);
    }
  }, [searchParams]);

  const onSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.error("Enter email and password");
      return;
    }
    setBusy(true);
    try {
      const user = await signInUser(email.trim(), password);
      if (user.mustChangePassword) {
        toast.success("Signed in — set a new password to continue");
        if (getAccessToken()) {
          window.location.href = "/change-password";
          return;
        }
      } else {
        toast.success(`Signed in as ${user.role}`, {
          description: `Opening dashboard (${getDashboardUrl()})…`,
        });
      }
      window.setTimeout(() => {
        void goToDashboard(user).catch(() => {
          toast.error("Signed in, but dashboard handoff failed. Open the dashboard and sign in again.");
          setBusy(false);
        });
      }, 150);
    } catch (err) {
      const message =
        err instanceof Error && err.message.trim()
          ? err.message
          : "Invalid email or password";
      toast.error(message);
      setBusy(false);
    }
  };

  return (
    <SiteLayout>
      <AuthShell
        title="Sign in"
        subtitle="Use the email and temporary password provided by your administrator."
      >
        <form onSubmit={onSignIn} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-brand-navy">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className={authInputClass}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-brand-navy">
              Password
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className={cn(authInputClass, "pr-10")}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-body"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="flex justify-end">
            <Link
              href={`/forgot-password${email ? `?email=${encodeURIComponent(email)}` : ""}`}
              className="text-sm font-semibold text-brand-orange hover:underline"
            >
              Forgot password?
            </Link>
          </div>

          <Button type="submit" disabled={busy} className={cn(authButtonClass)}>
            {busy ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-brand-body">
          Accounts are created by administrators only. Self-registration is not available.
        </p>
      </AuthShell>
    </SiteLayout>
  );
}

export default Login;
