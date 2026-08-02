import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PageHeader } from "@/components/dashboard/DashboardLayout";
import {
  formatRelativeTime,
  useNotifications,
  type AppNotification,
} from "@/components/dashboard/NotificationsContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Bell,
  CheckCheck,
  ClipboardList,
  Banknote,
  Info,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Settings2,
  Archive,
  Search,
  Wifi,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import {
  fetchNotificationPreferences,
  updateNotificationPreferences,
} from "@/lib/api";
import { useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/dashboard/notifications")({
  component: NotificationsPage,
});

const kindMeta: Record<
  AppNotification["kind"],
  { icon: typeof Bell; label: string; className: string }
> = {
  info: { icon: Info, label: "Info", className: "bg-sky-500/10 text-sky-700 dark:text-sky-300" },
  success: { icon: CheckCircle2, label: "Success", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  warning: { icon: AlertTriangle, label: "Warning", className: "bg-amber-500/15 text-amber-800 dark:text-amber-200" },
  assignment: { icon: ClipboardList, label: "Assignment", className: "bg-primary/10 text-primary" },
  fee: { icon: Banknote, label: "Fees", className: "bg-destructive/10 text-destructive" },
  system: { icon: Settings2, label: "System", className: "bg-muted text-muted-foreground" },
};

const priorityClass: Record<NonNullable<AppNotification["priority"]>, string> = {
  critical: "border-l-destructive bg-destructive/5",
  high: "border-l-amber-500",
  medium: "border-l-primary",
  low: "border-l-muted-foreground/40",
};

function NotificationsPage() {
  const {
    notifications,
    unreadCount,
    markRead,
    markAllRead,
    archive,
    removeNotification,
    clearAll,
    connected,
  } = useNotifications();

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "unread" | "read">("all");
  const [category, setCategory] = useState<string>("all");
  const [prefs, setPrefs] = useState({
    email_enabled: true,
    in_app_enabled: true,
    browser_enabled: true,
  });

  useEffect(() => {
    void fetchNotificationPreferences().then((p) => {
      if (!p) return;
      setPrefs({
        email_enabled: p.email_enabled,
        in_app_enabled: p.in_app_enabled,
        browser_enabled: p.browser_enabled,
      });
    });
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return notifications.filter((n) => {
      if (filter === "unread" && n.read) return false;
      if (filter === "read" && !n.read) return false;
      if (category !== "all" && (n.category || "").toUpperCase() !== category) return false;
      if (!q) return true;
      return (
        n.title.toLowerCase().includes(q) ||
        n.body.toLowerCase().includes(q) ||
        (n.eventCode || "").toLowerCase().includes(q)
      );
    });
  }, [notifications, query, filter, category]);

  const savePref = async (key: keyof typeof prefs, value: boolean) => {
    setPrefs((p) => ({ ...p, [key]: value }));
    const ok = await updateNotificationPreferences({ [key]: value });
    if (!ok) toast.error("Could not save preference");
    else toast.success("Preference saved");
  };

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle="Stay on top of assignments, fees, and account activity."
        action={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
            <span
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
              title={connected ? "Live updates connected" : "Live updates offline — polling via refresh"}
            >
              {connected ? (
                <Wifi className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
              ) : (
                <WifiOff className="h-3.5 w-3.5" aria-hidden />
              )}
              {connected ? "Live" : "Offline"}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
              disabled={unreadCount === 0}
              onClick={() => {
                markAllRead();
                toast.success("All notifications marked as read");
              }}
            >
              <CheckCheck className="mr-1 h-4 w-4" /> Mark all read
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
              disabled={notifications.length === 0}
              onClick={() => {
                clearAll();
                toast.message("Notification inbox cleared");
              }}
            >
              <Trash2 className="mr-1 h-4 w-4" /> Clear all
            </Button>
          </div>
        }
      />

      <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search notifications…"
              className="pl-9"
              aria-label="Search notifications"
            />
          </div>
          <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <SelectTrigger className="w-full sm:w-36" aria-label="Filter by read status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="unread">Unread</SelectItem>
              <SelectItem value="read">Read</SelectItem>
            </SelectContent>
          </Select>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-full sm:w-44" aria-label="Filter by category">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              <SelectItem value="ASSIGNMENT">Assignment</SelectItem>
              <SelectItem value="PAYMENT">Payment</SelectItem>
              <SelectItem value="ENROLLMENT">Enrollment</SelectItem>
              <SelectItem value="CERTIFICATE">Certificate</SelectItem>
              <SelectItem value="ATTENDANCE">Attendance</SelectItem>
              <SelectItem value="SECURITY">Security</SelectItem>
              <SelectItem value="SYSTEM">System</SelectItem>
              <SelectItem value="ANNOUNCEMENT">Announcement</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card className="border-border/60">
          <CardContent className="space-y-3 p-4">
            <p className="text-sm font-medium">Delivery preferences</p>
            {(
              [
                ["in_app_enabled", "In-app"] as const,
                ["email_enabled", "Email"] as const,
                ["browser_enabled", "Browser"] as const,
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between gap-3">
                <Label htmlFor={key} className="text-sm text-muted-foreground">
                  {label}
                </Label>
                <Switch
                  id={key}
                  checked={prefs[key]}
                  onCheckedChange={(v) => void savePref(key, v)}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {filtered.length === 0 ? (
        <Card className="border-border/60">
          <CardContent className="flex flex-col items-center py-16 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-muted">
              <Bell className="h-6 w-6 text-muted-foreground" />
            </span>
            <p className="mt-4 font-medium">You're all caught up</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {notifications.length === 0
                ? "New alerts will appear here."
                : "No notifications match your filters."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2" role="list" aria-label="Notification list">
          <AnimatePresence initial={false}>
            {filtered.map((n) => {
              const meta = kindMeta[n.kind];
              const Icon = meta.icon;
              const pClass = priorityClass[n.priority || "medium"];
              return (
                <motion.div
                  key={n.id}
                  role="listitem"
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card
                    className={`border-border/60 border-l-4 transition-colors ${pClass} ${
                      n.read ? "opacity-80" : ""
                    }`}
                  >
                    <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start">
                      <span
                        className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${meta.className}`}
                      >
                        <Icon className="h-4 w-4" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{n.title}</p>
                          {!n.read && (
                            <Badge variant="secondary" className="text-[10px]">
                              New
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-[10px]">
                            {meta.label}
                          </Badge>
                          {n.priority === "critical" && (
                            <Badge variant="destructive" className="text-[10px]">
                              Critical
                            </Badge>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {formatRelativeTime(n.createdAt)}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {n.href && (
                            <Button asChild size="sm" variant="default" onClick={() => markRead(n.id)}>
                              <Link to={n.href}>Open</Link>
                            </Button>
                          )}
                          {!n.read && (
                            <Button size="sm" variant="outline" onClick={() => markRead(n.id)}>
                              Mark read
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              archive(n.id);
                              toast.message("Archived");
                            }}
                          >
                            <Archive className="mr-1 h-3.5 w-3.5" /> Archive
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-muted-foreground"
                            onClick={() => removeNotification(n.id)}
                          >
                            Dismiss
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </>
  );
}
