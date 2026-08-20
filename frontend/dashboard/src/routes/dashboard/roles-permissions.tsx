import { createFileRoute } from "@tanstack/react-router";
import { RolesPermissionsPage } from "@/components/dashboard/RolesPermissionsPage";
import { requireAuth } from "@/lib/route-guards";

export const Route = createFileRoute("/dashboard/roles-permissions")({
  beforeLoad: requireAuth(["admin"]),
  component: RolesPermissionsPage,
});
