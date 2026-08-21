import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { clearTokens, setTokens } from "@/lib/api";
import { resolveApiBase, resolveDjangoOrigin } from "@/lib/api-base";
import { emitAuthChanged } from "@/lib/auth-events";
import {
  dashboardPathForRole,
  normalizeApiRole,
  rememberEmailRole,
  resolveLoginRole,
} from "@/lib/auth-routes";
import { getWebLoginUrl } from "@/lib/web-url";
import { Loader2 } from "lucide-react";
import type { AuthUser, Role } from "@/components/dashboard/AuthContext";

const STORAGE_KEY = "shikshalab_auth";
const API_BASE = resolveApiBase();

type Handoff = {
  access?: string;
  refresh?: string;
  role?: string;
  email?: string;
  name?: string;
  path?: string;
  code?: string;
};

/**
 * Read handoff only from the live URL.
 * Do NOT use route validateSearch here — TanStack JSON-parses params
 * and can strip/rewrite the query, which breaks site → dashboard login.
 */
function readHandoffFromUrl(): Handoff {
  if (typeof window === "undefined") return {};
  const qs = new URLSearchParams(window.location.search);
  const hash = window.location.hash.startsWith("#")
    ? new URLSearchParams(window.location.hash.slice(1))
    : null;
  const get = (key: string) => qs.get(key) || hash?.get(key) || undefined;
  return {
    access: get("access"),
    refresh: get("refresh"),
    role: get("role"),
    email: get("email"),
    name: get("name"),
    path: get("path"),
    code: get("code"),
  };
}

function persistAuthUser(partial: {
  role: Role;
  email: string;
  name: string;
  backend: boolean;
  mustChangePassword?: boolean;
}) {
  const role = partial.role;
  const user: AuthUser = {
    role,
    email: partial.email,
    name:
      partial.name ||
      (role === "admin" ? "Admin" : role === "teacher" ? "Teacher" : "Student"),
    backend: partial.backend,
    mustChangePassword: Boolean(partial.mustChangePassword),
    teacherName: role === "teacher" ? partial.name || undefined : undefined,
    studentId: role === "student" ? undefined : undefined,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  rememberEmailRole(user.email, user.role);
  emitAuthChanged();
}

function resolveRole(handoff: Handoff): Role {
  if (handoff.role) return normalizeApiRole(handoff.role);
  if (handoff.email) return resolveLoginRole(handoff.email);
  return "student";
}

async function consumeHandoffCode(code: string): Promise<{
  access: string;
  refresh: string;
  email?: string;
  role?: string;
  name?: string;
  must_change_password?: boolean;
} | null> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 8000);
  try {
    // Prefer absolute Django URL; relative /api/v1 can hang when Vite proxy is broken.
    const base =
      (typeof import.meta !== "undefined" &&
        (import.meta as { env?: { VITE_API_URL?: string; VITE_DJANGO_ORIGIN?: string } }).env
          ?.VITE_API_URL) ||
      API_BASE;
    const djangoOrigin =
      (typeof import.meta !== "undefined" &&
        (import.meta as { env?: { VITE_DJANGO_ORIGIN?: string } }).env?.VITE_DJANGO_ORIGIN) ||
      resolveDjangoOrigin();
    const consumeUrl = base.startsWith("http")
      ? `${base.replace(/\/$/, "")}/accounts/auth/handoff/consume/`
      : `${djangoOrigin.replace(/\/$/, "")}/api/v1/accounts/auth/handoff/consume/`;

    const res = await fetch(consumeUrl, {
      method: "POST",
      credentials: "include",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const body = await res.json();
    const data = body?.data && typeof body.data === "object" ? body.data : body;
    if (!data?.access) return null;
    return data;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const [status, setStatus] = useState("Opening your dashboard…");

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const handoff = readHandoffFromUrl();
      let access = handoff.access;
      let refresh = handoff.refresh;
      let email = handoff.email;
      let name = handoff.name;
      let roleHint = handoff.role;
      let mustChange =
        new URLSearchParams(window.location.search).get("must_change") === "1";

      // Hash tokens from site are enough — skip consume when already present (avoids
      // hanging on a broken Vite /api proxy). Use handoff code only as fallback.
      if (!access && handoff.code) {
        setStatus("Completing secure sign-in…");
        const consumed = await consumeHandoffCode(handoff.code);
        if (cancelled) return;
        if (consumed?.access) {
          access = consumed.access;
          refresh = consumed.refresh;
          email = consumed.email || email;
          name = consumed.name || name;
          roleHint = consumed.role || roleHint;
          if (consumed.must_change_password) mustChange = true;
        }
      } else if (access && handoff.code) {
        // Best-effort consume so the one-time code is invalidated; ignore failures.
        void consumeHandoffCode(handoff.code);
      }

      const resolvedRole = roleHint
        ? normalizeApiRole(roleHint)
        : email
          ? resolveLoginRole(email)
          : resolveRole(handoff);

      const destination =
        handoff.path && handoff.path.startsWith("/")
          ? handoff.path
          : dashboardPathForRole(resolvedRole);
      const finalDest = mustChange || destination === "/change-password" ? "/change-password" : destination;

      const go = (dest: string) => {
        window.location.replace(`${window.location.origin}${dest}`);
      };

      try {
        if (access) {
          setTokens(access, refresh);
          if (email) {
            persistAuthUser({
              role: resolvedRole,
              email,
              name: name || email,
              backend: true,
              mustChangePassword: mustChange,
            });
          }
          setStatus(`Signed in as ${resolvedRole}. Redirecting…`);
          go(finalDest);
          return;
        }

        // Never invent a session without JWTs — send back to login
        clearTokens();
        setStatus("Missing login details. Returning to sign in…");
        window.setTimeout(() => {
          window.location.href = getWebLoginUrl();
        }, 600);
      } catch (err) {
        console.error("Auth callback failed", err);
        setStatus("Could not complete sign-in.");
        window.location.href = getWebLoginUrl();
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {status}
      </div>
    </div>
  );
}
