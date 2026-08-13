"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { SiteLayout, PageHero } from "@/components/layout/SiteLayout";
import { AuthShell, authButtonClass, authInputClass } from "@/components/layout/AuthShell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { apiChangePassword, getAccessToken } from "@/lib/api";
import { useAuth } from "@/components/dashboard/AuthContext";
import { getDashboardUrl } from "@/lib/env";
import { dashboardPathForRole } from "@/lib/auth-routes";
import { cn } from "@/lib/utils";

export default function ChangePasswordPage() {
  const { user, refreshFromApi } = useAuth();
  const router = useRouter();
  const [oldPassword, setOldPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!getAccessToken()) {
      toast.error("Sign in first to change your password");
      router.push("/login");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setBusy(true);
    const result = await apiChangePassword({
      old_password: oldPassword || undefined,
      new_password: password,
      new_password_confirm: confirm,
    });
    setBusy(false);
    if (!result.ok) {
      toast.error(result.detail || "Could not change password");
      return;
    }
    await refreshFromApi();
    toast.success("Password updated");
    const dash = getDashboardUrl().replace(/\/$/, "");
    const path = dashboardPathForRole(user.role);
    const access = getAccessToken();
    const qs = new URLSearchParams({
      role: user.role,
      email: user.email,
      name: user.name || user.email,
      path,
    });
    if (access) qs.set("access", access);
    window.location.href = `${dash}/auth/callback?${qs.toString()}`;
  };

  return (
    <SiteLayout flushTop>
      <PageHero
        eyebrow="Account"
        title="Change password"
        subtitle={
          user?.mustChangePassword
            ? "You must set a new password before continuing."
            : "Update your account password."
        }
      />
      <AuthShell
        compact
        title="Change password"
        subtitle={
          user?.mustChangePassword
            ? "You must set a new password before continuing."
            : "Update your account password."
        }
      >
        <form onSubmit={onSubmit} className="space-y-4">
          {!user?.mustChangePassword && (
            <div className="space-y-2">
              <Label htmlFor="old" className="text-brand-navy">
                Current password
              </Label>
              <Input
                id="old"
                name="old_password"
                type="password"
                autoComplete="current-password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className={authInputClass}
              />
            </div>
          )}
          {user?.mustChangePassword && (
            <div className="space-y-2">
              <Label htmlFor="old" className="text-brand-navy">
                Temporary password (optional)
              </Label>
              <Input
                id="old"
                name="old_password"
                type="password"
                autoComplete="current-password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className={authInputClass}
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="password" className="text-brand-navy">
              New password
            </Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className={authInputClass}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm" className="text-brand-navy">
              Confirm new password
            </Label>
            <Input
              id="confirm"
              name="confirm_password"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              className={authInputClass}
            />
          </div>
          <Button type="submit" className={cn(authButtonClass)} disabled={busy}>
            {busy ? "Saving…" : "Save password"}
          </Button>
        </form>
      </AuthShell>
    </SiteLayout>
  );
}
