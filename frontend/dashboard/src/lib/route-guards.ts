import { redirect } from "@tanstack/react-router";
import type { Role } from "@/components/dashboard/AuthContext";
import { getAccessToken, getRefreshToken } from "@/lib/api";
import { getWebLoginUrl } from "@/lib/web-url";

const STORAGE_KEY = "shikshalab_auth";

function readSession(): { role: Role; email: string; mustChangePassword: boolean } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      role?: Role;
      email?: string;
      mustChangePassword?: boolean;
    };
    if (!parsed.email || !parsed.role) return null;
    return {
      role: parsed.role,
      email: parsed.email,
      mustChangePassword: Boolean(parsed.mustChangePassword),
    };
  } catch {
    return null;
  }
}

/**
 * Client-side route guard for dashboard pages.
 * Unauthenticated users are sent to the public site login (single sign-in form).
 * Requires JWT tokens — identity without tokens cannot upload or call APIs.
 */
export function requireAuth(allowed?: Role[]) {
  return () => {
    if (typeof window === "undefined") return;

    const session = readSession();
    const hasJwt = Boolean(getAccessToken() || getRefreshToken());
    if (!session || !hasJwt) {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
      window.location.replace(getWebLoginUrl(window.location.pathname));
      throw redirect({ to: "/login" });
    }
    if (session.mustChangePassword) {
      throw redirect({ to: "/change-password" });
    }
    if (allowed && allowed.length > 0 && !allowed.includes(session.role)) {
      throw redirect({ to: "/dashboard" });
    }
  };
}
