import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/dashboard/DashboardLayout";
import { useSettings } from "@/components/dashboard/SettingsContext";
import { useAuth } from "@/components/dashboard/AuthContext";
import { useNotifications } from "@/components/dashboard/NotificationsContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { changePassword as apiChangePassword } from "@/lib/api";
import { toast } from "sonner";
import { Bell, Lock, RotateCcw, Save, Shield } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/dashboard/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useAuth();
  const { settings, updateSettings, saveSettings, resetSettings } = useSettings();
  const { addNotification } = useNotifications();
  const [password, setPassword] = useState({ current: "", next: "", confirm: "" });
  const [saving, setSaving] = useState(false);

  const savePrefs = async () => {
    setSaving(true);
    try {
      await saveSettings();
      toast.success("Settings saved");
      addNotification({
        title: "Settings updated",
        body: "Your notification and preference settings were saved.",
        kind: "system",
        href: "/dashboard/settings",
      });
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    if (!password.current || !password.next) {
      toast.error("Enter current and new password");
      return;
    }
    if (password.next.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }
    if (password.next !== password.confirm) {
      toast.error("New passwords do not match");
      return;
    }
    const result = await apiChangePassword({
      old_password: password.current,
      new_password: password.next,
      new_password_confirm: password.confirm,
    });
    if (!result.ok) {
      // Demo mode without JWT — accept locally
      const token = typeof window !== "undefined"
        ? localStorage.getItem("shikshalab_access_token")
        : null;
      if (token) {
        toast.error(result.message || "Could not update password");
        return;
      }
    }
    setPassword({ current: "", next: "", confirm: "" });
    toast.success("Password updated", { description: "Use your new password next time you sign in." });
    addNotification({
      title: "Password changed",
      body: "Your account password was updated successfully.",
      kind: "success",
    });
  };

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Control notifications, security and account preferences."
        action={
          <Button className="btn-highlight" disabled={saving} onClick={() => void savePrefs()}>
            <Save className="mr-1 h-4 w-4" /> Save preferences
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="h-4 w-4 text-primary" /> Notifications
            </CardTitle>
            <p className="text-xs text-muted-foreground">Choose what you want to be notified about.</p>
          </CardHeader>
          <CardContent className="space-y-5">
            <PrefRow
              label="Email notifications"
              hint="Receive important account emails"
              checked={settings.emailNotifications}
              onChange={(v) => updateSettings({ emailNotifications: v })}
            />
            <PrefRow
              label="Assignment alerts"
              hint="New portals, due dates and grades"
              checked={settings.assignmentAlerts}
              onChange={(v) => updateSettings({ assignmentAlerts: v })}
            />
            <PrefRow
              label="Fee reminders"
              hint="Overdue and upcoming payment notices"
              checked={settings.feeReminders}
              onChange={(v) => updateSettings({ feeReminders: v })}
            />
            <PrefRow
              label="Weekly digest"
              hint="Summary of activity every Monday"
              checked={settings.digestWeekly}
              onChange={(v) => updateSettings({ digestWeekly: v })}
            />
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4 text-primary" /> Preferences
            </CardTitle>
            <p className="text-xs text-muted-foreground">Language, region and layout.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Language</Label>
              <Select value={settings.language} onValueChange={(v) => updateSettings({ language: v as "en" | "ne" })}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="ne">नेपाली (Nepali)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Timezone</Label>
              <Select value={settings.timezone} onValueChange={(v) => updateSettings({ timezone: v })}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Asia/Kolkata", "Asia/Dubai", "UTC", "America/New_York", "Europe/London"].map((tz) => (
                    <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <PrefRow
              label="Compact sidebar"
              hint="Reduce spacing in the left navigation"
              checked={settings.compactSidebar}
              onChange={(v) => updateSettings({ compactSidebar: v })}
            />
            <div className="rounded-lg border border-border/60 bg-muted/40 p-3 text-xs text-muted-foreground">
              Signed in as <span className="font-medium text-foreground">{user.email}</span> · role{" "}
              <span className="capitalize font-medium text-foreground">{user.role}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                resetSettings();
                toast.message("Preferences reset to defaults");
              }}
            >
              <RotateCcw className="mr-1 h-3.5 w-3.5" /> Reset preferences
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/60 lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Lock className="h-4 w-4 text-primary" /> Security
            </CardTitle>
            <p className="text-xs text-muted-foreground">Update your password. Demo stores the change locally only.</p>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label>Current password</Label>
              <Input
                className="mt-1.5"
                type="password"
                value={password.current}
                onChange={(e) => setPassword({ ...password, current: e.target.value })}
              />
            </div>
            <div>
              <Label>New password</Label>
              <Input
                className="mt-1.5"
                type="password"
                value={password.next}
                onChange={(e) => setPassword({ ...password, next: e.target.value })}
              />
            </div>
            <div>
              <Label>Confirm new password</Label>
              <Input
                className="mt-1.5"
                type="password"
                value={password.confirm}
                onChange={(e) => setPassword({ ...password, confirm: e.target.value })}
              />
            </div>
            <div className="sm:col-span-3 flex justify-end">
              <Button onClick={() => void changePassword()}>Update password</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function PrefRow({
  label, hint, checked, onChange,
}: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
