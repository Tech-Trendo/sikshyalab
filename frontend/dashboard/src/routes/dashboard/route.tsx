import { createFileRoute, Outlet } from "@tanstack/react-router";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { DashboardDataProvider } from "@/components/dashboard/DashboardDataContext";
import { NotificationsProvider } from "@/components/dashboard/NotificationsContext";
import { SettingsProvider } from "@/components/dashboard/SettingsContext";
import { ContentProtection } from "@/components/dashboard/ContentProtection";
import { requireAuth } from "@/lib/route-guards";

export const Route = createFileRoute("/dashboard")({
  beforeLoad: requireAuth(["admin", "teacher", "student"]),
  head: () => ({ meta: [{ title: "Dashboard — ShikshaLab" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <DashboardDataProvider>
      <SettingsProvider>
        <NotificationsProvider>
          <ContentProtection>
            <DashboardLayout>
              <Outlet />
            </DashboardLayout>
          </ContentProtection>
        </NotificationsProvider>
      </SettingsProvider>
    </DashboardDataProvider>
  ),
});
