import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShikshaLabLogo } from "@/components/brand/ShikshaLabLogo";
import { useAuth } from "@/components/dashboard/AuthContext";
import { apiChangePassword, getAccessToken } from "@/lib/api";
import { dashboardPathForRole } from "@/lib/auth-routes";
import { redirectToWebLogin } from "@/lib/web-url";
import { toast } from "sonner";

export const Route = createFileRoute("/change-password")({
  component: ChangePasswordPage,
});

function ChangePasswordPage() {
  const { user, refreshFromApi } = useAuth();
  const navigate = useNavigate();
  const [oldPassword, setOldPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!getAccessToken()) {
      toast.error("Sign in required");
      redirectToWebLogin();
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
    window.location.replace(
      `${window.location.origin}${dashboardPathForRole(user.role)}`,
    );
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-6 p-6 sm:p-8">
          <div className="flex flex-col items-center gap-2 text-center">
            <ShikshaLabLogo className="h-10 w-auto" />
            <h1 className="text-xl font-semibold">Change password</h1>
            <p className="text-sm text-muted-foreground">
              {user.mustChangePassword
                ? "You must set a new password before using the dashboard."
                : "Update your password."}
            </p>
          </div>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="old">
                {user.mustChangePassword ? "Temporary password (optional)" : "Current password"}
              </Label>
              <Input
                id="old"
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm new password</Label>
              <Input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="btn-highlight w-full" disabled={busy}>
              {busy ? "Saving…" : "Save password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
