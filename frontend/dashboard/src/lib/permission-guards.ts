import { redirect } from "@tanstack/react-router";
import { fetchPermissionsForCurrentAuthUser } from "@/lib/roles-api";

/**
 * Route-level permission guard for TanStack Start.
 *
 * Usage:
 * beforeLoad: requirePermission("assignments.view")
 */
export function requirePermission(permission: string) {
  return async () => {
    if (typeof window === "undefined") return;

    const perms = await fetchPermissionsForCurrentAuthUser();
    if (!perms.includes(permission)) {
      throw redirect({ to: "/dashboard/unauthorized" });
    }
  };
}

