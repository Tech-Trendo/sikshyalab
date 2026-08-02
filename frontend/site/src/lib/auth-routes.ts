import type { Role } from "@/components/dashboard/AuthContext";

const ROLE_REGISTRY_KEY = "shikshalab_role_registry";

type RoleRegistry = Record<string, Role>;

function readRegistry(): RoleRegistry {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(ROLE_REGISTRY_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as RoleRegistry;
  } catch {
    return {};
  }
}

function writeRegistry(registry: RoleRegistry) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ROLE_REGISTRY_KEY, JSON.stringify(registry));
}

/** Persist the role chosen at signup so later logins resolve correctly. */
export function rememberEmailRole(email: string, role: Role) {
  const key = email.trim().toLowerCase();
  if (!key) return;
  const registry = readRegistry();
  registry[key] = role;
  writeRegistry(registry);
}

export function lookupEmailRole(email: string): Role | null {
  const key = email.trim().toLowerCase();
  if (!key) return null;
  return readRegistry()[key] ?? null;
}

/** Post-login landing route per role. */
export function dashboardPathForRole(role: Role): string {
  switch (role) {
    case "teacher":
      return "/dashboard";
    case "student":
      return "/dashboard/courses";
    case "admin":
    default:
      return "/dashboard";
  }
}

export function normalizeApiRole(raw?: string | null): Role {
  const value = (raw || "STUDENT").toUpperCase();
  if (value === "TEACHER") return "teacher";
  if (value === "STUDENT") return "student";
  if (value === "ADMIN") return "admin";
  return "student";
}

/** Prefer API role; demo emails (admin/teacher) beat a stale registry entry. */
export function resolveLoginRole(email: string, apiRole?: string | null): Role {
  if (apiRole) return normalizeApiRole(apiRole);
  const e = email.toLowerCase().trim();
  if (e.includes("admin")) return "admin";
  if (e.includes("teacher") || e.includes("instructor")) return "teacher";
  const remembered = lookupEmailRole(email);
  if (remembered) return remembered;
  return "student";
}
