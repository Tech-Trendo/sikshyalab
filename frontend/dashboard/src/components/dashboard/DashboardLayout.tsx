import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Users, GraduationCap, BookOpen, Layers, Clock, Banknote,
  Award, ClipboardList, Globe, Bell, LogOut, Settings, Kanban, FileText, FolderOpen,
  User, CheckCheck, Info, CheckCircle2, AlertTriangle, Settings2, MessageSquareQuote, Sparkles,
  Menu, CalendarDays, Newspaper, Mail, Briefcase, Handshake, ExternalLink,
} from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAuth, type Role } from "@/components/dashboard/AuthContext";
import { formatRelativeTime, useNotifications, type AppNotification } from "@/components/dashboard/NotificationsContext";
import { useSettings } from "@/components/dashboard/SettingsContext";
import { ShikshaLabLogo } from "@/components/brand/ShikshaLabLogo";
import { getAccessToken, getRefreshToken } from "@/lib/api";
import { getWebUrl, redirectToWebLogin } from "@/lib/web-url";

const groups: Record<Role, { label: string; items: { to: string; label: string; icon: any }[] }[]> = {
  admin: [
    {
      label: "Overview",
      items: [{ to: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
    },
    {
      label: "Academics",
      items: [
        { to: "/dashboard/students", label: "Students", icon: Users },
        { to: "/dashboard/teachers", label: "Teachers", icon: GraduationCap },
        { to: "/dashboard/courses", label: "Courses", icon: BookOpen },
        { to: "/dashboard/categories", label: "Categories", icon: FolderOpen },
        { to: "/dashboard/batches", label: "Batches", icon: Layers },
        { to: "/dashboard/shifts", label: "Shifts", icon: Clock },
        { to: "/dashboard/assignments", label: "Assignments", icon: ClipboardList },
      ],
    },
    {
      label: "Operations",
      items: [
        { to: "/dashboard/fees", label: "Fees", icon: Banknote },
        { to: "/dashboard/certificates", label: "Certificates", icon: Award },
        { to: "/dashboard/tasks", label: "Task Board", icon: Kanban },
      ],
    },
    {
      label: "Website",
      items: [
        { to: "/dashboard/content", label: "Content", icon: Globe },
        { to: "/dashboard/events", label: "Events", icon: CalendarDays },
        { to: "/dashboard/blog", label: "Blog", icon: Newspaper },
        { to: "/dashboard/gallery", label: "Gallery", icon: FolderOpen },
        { to: "/dashboard/partners", label: "Partners", icon: Handshake },
        { to: "/dashboard/careers", label: "Careers", icon: Briefcase },
        { to: "/dashboard/messages", label: "Messages", icon: Mail },
        { to: "/dashboard/reviews", label: "Reviews", icon: MessageSquareQuote },
        { to: "/dashboard/testimonials", label: "Testimonials", icon: Sparkles },
        { to: "/dashboard/seo", label: "SEO", icon: FileText },
      ],
    },
  ],
  teacher: [
    { label: "Overview", items: [{ to: "/dashboard", label: "Dashboard", icon: LayoutDashboard }] },
    {
      label: "Teaching",
      items: [
        { to: "/dashboard/courses", label: "My Courses", icon: BookOpen },
        { to: "/dashboard/batches", label: "Batches", icon: Layers },
        { to: "/dashboard/assignments", label: "Assignments", icon: ClipboardList },
        { to: "/dashboard/students", label: "Students", icon: Users },
        { to: "/dashboard/tasks", label: "Task Board", icon: Kanban },
        { to: "/dashboard/resources", label: "Resources", icon: FolderOpen },
      ],
    },
  ],
  student: [
    { label: "Overview", items: [{ to: "/dashboard", label: "Dashboard", icon: LayoutDashboard }] },
    {
      label: "Learning",
      items: [
        { to: "/dashboard/courses", label: "My Courses", icon: BookOpen },
        { to: "/dashboard/tasks", label: "Task Board", icon: Kanban },
        { to: "/dashboard/assignments", label: "Assignments", icon: ClipboardList },
        { to: "/dashboard/resources", label: "Resources", icon: FolderOpen },
        { to: "/dashboard/certificates", label: "Certificates", icon: Award },
        { to: "/dashboard/fees", label: "Fees", icon: Banknote },
      ],
    },
  ],
};

const kindIcon: Record<AppNotification["kind"], typeof Bell> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  assignment: ClipboardList,
  fee: Banknote,
  system: Settings2,
};

function pageTitleFromPath(path: string, role: Role): string {
  const flat = groups[role].flatMap((g) => g.items);
  const match = flat.find((item) => item.to === path);
  if (match) return match.label;
  if (path.includes("/profile")) return "Profile";
  if (path.includes("/settings")) return "Settings";
  if (path.includes("/notifications")) return "Notifications";
  if (path.includes("/resources")) return "Resources";
  return "Dashboard";
}

function DashboardNav({
  role,
  path,
  navPy,
  onNavigate,
}: {
  role: Role;
  path: string;
  navPy: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4">
      {groups[role].map((g) => (
        <div key={g.label} className="mb-4">
          <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{g.label}</p>
          <ul className="space-y-0.5">
            {g.items.map((item) => {
              const active = path === item.to;
              const Icon = item.icon;
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    onClick={onNavigate}
                    className={`flex items-center gap-2.5 rounded-md px-2.5 text-sm font-medium transition-colors ${navPy} ${
                      active ? "bg-primary text-primary-foreground shadow-sm" : "text-sidebar-foreground hover:bg-sidebar-accent"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, authReady, signOut: clearAuth } = useAuth();
  const { settings } = useSettings();
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const role = user.role;
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const sidebarW = settings.compactSidebar ? "w-56" : "w-64";
  const navPy = settings.compactSidebar ? "py-1.5" : "py-2";
  const pageTitle = useMemo(() => pageTitleFromPath(path, role), [path, role]);

  // No session / tokens → public site login (only after auth hydrate)
  useEffect(() => {
    if (!authReady) return;
    if (!user.email) {
      redirectToWebLogin();
      return;
    }
    // Identity without JWTs cannot upload CMS media — force re-login via site handoff
    if (!getAccessToken() && !getRefreshToken()) {
      redirectToWebLogin();
    }
  }, [authReady, user.email]);

  const signOut = () => {
    clearAuth();
    redirectToWebLogin();
  };

  const initials = (user.name || user.email || "?")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const preview = notifications.slice(0, 6);

  const openNotification = (n: AppNotification) => {
    markRead(n.id);
    setNotificationsOpen(false);
    if (n.href) navigate({ to: n.href });
    else navigate({ to: "/dashboard/notifications" });
  };

  const goToAllNotifications = () => {
    setNotificationsOpen(false);
    navigate({ to: "/dashboard/notifications" });
  };

  if (!authReady || !user.email) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary/40">
        <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p>Loading your workspace…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-secondary/40">
      <aside className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex ${sidebarW}`}>
        <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-5">
          <a
            href={getWebUrl()}
            className="flex min-w-0 items-center gap-2"
            title="Back to website"
          >
            <ShikshaLabLogo imageClassName="h-8 w-auto max-w-[130px]" />
            <div className="min-w-0">
              <p className="text-[10px] capitalize text-muted-foreground">{role} portal</p>
            </div>
          </a>
        </div>
        <DashboardNav role={role} path={path} navPy={navPy} />
        <div className="space-y-1 border-t border-sidebar-border p-3">
          <button
            type="button"
            onClick={signOut}
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
          <a
            href={getWebUrl()}
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent"
          >
            <ExternalLink className="h-4 w-4" /> Back to site
          </a>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/90 px-3 backdrop-blur sm:h-16 sm:gap-3 sm:px-4 md:px-6">
          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0 lg:hidden" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex w-[min(100vw-2rem,18rem)] flex-col p-0">
              <SheetHeader className="border-b border-border px-4 py-4 text-left">
                <div className="flex items-center gap-2">
                  <ShikshaLabLogo imageClassName="h-9 w-auto max-w-[140px]" />
                  <div>
                    <SheetTitle className="sr-only">ShikshaLab</SheetTitle>
                    <p className="text-[10px] capitalize text-muted-foreground">{role} portal</p>
                  </div>
                </div>
              </SheetHeader>
              <DashboardNav role={role} path={path} navPy={navPy} onNavigate={() => setMobileNavOpen(false)} />
              <div className="mt-auto space-y-1 border-t border-border p-3">
                <button
                  type="button"
                  onClick={() => {
                    setMobileNavOpen(false);
                    signOut();
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm text-muted-foreground hover:bg-muted"
                >
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
                <a
                  href={getWebUrl()}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm text-muted-foreground hover:bg-muted"
                  onClick={() => setMobileNavOpen(false)}
                >
                  <ExternalLink className="h-4 w-4" /> Back to site
                </a>
              </div>
            </SheetContent>
          </Sheet>

          <div className="min-w-0 flex-1 lg:hidden">
            <p className="truncate text-sm font-semibold text-foreground">{pageTitle}</p>
            <p className="truncate text-[10px] capitalize text-muted-foreground">{role}</p>
          </div>

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <Popover open={notificationsOpen} onOpenChange={setNotificationsOpen}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative shrink-0" aria-label="Notifications">
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-highlight px-1 text-[10px] font-bold text-highlight-foreground animate-pulse">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[calc(100vw-2rem)] max-w-sm p-0 sm:max-w-md">
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold">Notifications</p>
                    <p className="text-xs text-muted-foreground">
                      {unreadCount === 0 ? "All caught up" : `${unreadCount} unread`}
                    </p>
                  </div>
                  {unreadCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 shrink-0 text-xs"
                      onClick={() => markAllRead()}
                    >
                      <CheckCheck className="mr-1 h-3.5 w-3.5" /> Mark all
                    </Button>
                  )}
                </div>
                <div className="max-h-[min(20rem,50vh)] space-y-0.5 overflow-y-auto p-2">
                  {preview.length === 0 ? (
                    <p className="px-2 py-8 text-center text-sm text-muted-foreground">No notifications yet</p>
                  ) : (
                    preview.map((n) => {
                      const Icon = kindIcon[n.kind];
                      return (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => openNotification(n)}
                          className={`flex w-full items-start gap-3 rounded-lg p-2.5 text-left transition-colors hover:bg-muted/60 ${
                            n.read ? "" : "bg-primary/5"
                          }`}
                        >
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                            <Icon className="h-4 w-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <p className={`text-sm ${n.read ? "font-medium" : "font-semibold"}`}>{n.title}</p>
                              {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-highlight" />}
                            </div>
                            <p className="line-clamp-2 text-xs text-muted-foreground">{n.body}</p>
                            <p className="mt-1 text-[10px] text-muted-foreground">{formatRelativeTime(n.createdAt)}</p>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
                <div className="border-t border-border p-2">
                  <Button
                    variant="ghost"
                    className="w-full text-sm"
                    onClick={goToAllNotifications}
                  >
                    View all notifications
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="flex items-center gap-2 rounded-full pr-1 hover:bg-muted sm:pr-2">
                  <Avatar className="h-8 w-8 shrink-0">
                    {user.avatar ? <AvatarImage src={user.avatar} alt={user.name} /> : null}
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <div className="hidden min-w-0 text-left md:block">
                    <p className="truncate text-xs font-semibold leading-none">{user.name}</p>
                    <p className="truncate text-[10px] text-muted-foreground">{user.email}</p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel className="capitalize">Signed in as {role}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate({ to: "/dashboard/profile" })}>
                  <User className="mr-2 h-4 w-4" /> Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setNotificationsOpen(false); navigate({ to: "/dashboard/notifications" }); }}>
                  <Bell className="mr-2 h-4 w-4" /> Notifications
                  {unreadCount > 0 && (
                    <span className="ml-auto rounded-full bg-highlight px-1.5 text-[10px] font-bold text-highlight-foreground">
                      {unreadCount}
                    </span>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate({ to: "/dashboard/settings" })}>
                  <Settings className="mr-2 h-4 w-4" /> Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut}>
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="min-w-0 flex-1 p-3 sm:p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

export function StatCard({
  label, value, delta, icon: Icon, tone = "primary", href,
}: { label: string; value: string | number; delta?: string; icon: any; tone?: "primary" | "highlight" | "info" | "success"; href?: string }) {
  const toneMap = {
    primary: "bg-primary/10 text-primary",
    highlight: "bg-highlight/15 text-[color:var(--highlight-foreground)]",
    info: "bg-info/10 text-info",
    success: "bg-success/10 text-success",
  } as const;
  const content = (
    <>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="mt-2 text-xl font-bold text-foreground sm:text-2xl">{value}</p>
        {delta && <p className="mt-1 text-xs font-medium text-success">{delta}</p>}
      </div>
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl sm:h-11 sm:w-11 ${toneMap[tone]}`}>
        <Icon className="h-5 w-5" />
      </span>
    </>
  );
  if (href) {
    return (
      <Link to={href} className="card-soft flex items-start justify-between gap-3 p-4 sm:p-5 transition-shadow hover:shadow-md">
        {content}
      </Link>
    );
  }
  return <div className="card-soft flex items-start justify-between gap-3 p-4 sm:p-5">{content}</div>;
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-col justify-between gap-3 sm:mb-6 sm:flex-row sm:items-end">
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action && <div className="flex shrink-0 flex-wrap gap-2">{action}</div>}
    </div>
  );
}

/** Wrap wide tables: horizontal scroll on tablet, optional mobile cards below. */
export function ResponsiveTable({
  children,
  mobile,
  className = "",
}: {
  children: ReactNode;
  mobile?: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      {mobile && <div className="space-y-3 md:hidden">{mobile}</div>}
      <div className={mobile ? "hidden md:block" : "overflow-x-auto"}>
        <div className={mobile ? "" : "min-w-[640px]"}>{children}</div>
      </div>
    </div>
  );
}
