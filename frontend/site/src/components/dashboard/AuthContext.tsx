"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  apiLogin,
  apiLogout,
  clearTokens,
  ensureAccessToken,
  fetchProfile,
  getAccessToken,
  fetchRoleProfileIds,
  mapApiUserToAuth,
  updateProfile as apiUpdateProfile,
} from "@/lib/api";
import { emitAuthChanged } from "@/lib/auth-events";
import { normalizeApiRole, rememberEmailRole } from "@/lib/auth-routes";
import { ApiError } from "@/lib/http-client";

export type Role = "admin" | "teacher" | "student";

export type AuthUser = {
  name: string;
  email: string;
  role: Role;
  phone?: string;
  bio?: string;
  title?: string;
  avatar?: string;
  location?: string;
  /** Matches mock teacher name for scoping assigned courses/batches */
  teacherName?: string;
  /** Matches mock student id for scoping enrollments/tasks */
  studentId?: string;
  /** True when session is backed by JWT */
  backend?: boolean;
  /** Force password change before using the app */
  mustChangePassword?: boolean;
};

const STORAGE_KEY = "shikshalab_auth";

const defaults: Record<Role, AuthUser> = {
  admin: {
    name: "Admin",
    email: "admin@shikshalab.io",
    role: "admin",
    avatar: "",
  },
  teacher: {
    name: "Teacher",
    email: "teacher@shikshalab.io",
    role: "teacher",
    teacherName: "",
    avatar: "",
  },
  student: {
    name: "Student",
    email: "student@shikshalab.io",
    role: "student",
    studentId: "",
    avatar: "",
  },
};

function readStored(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

type AuthContextValue = {
  user: AuthUser;
  isTeacher: boolean;
  isAdmin: boolean;
  isStudent: boolean;
  signIn: (email: string, password: string) => Promise<AuthUser>;
  signUp: (data: {
    name: string;
    email: string;
    phone?: string;
    password: string;
    role: "student" | "teacher";
  }) => Promise<AuthUser>;
  updateProfile: (patch: Partial<AuthUser>) => Promise<AuthUser>;
  signOut: () => Promise<void>;
  refreshFromApi: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser>(() => {
    const stored = readStored();
    const hasToken = Boolean(getAccessToken());
    // Mock sessions must win over leftover JWTs
    if (stored?.backend === false && stored.email) {
      if (hasToken) clearTokens();
      return { ...defaults[stored.role], ...stored };
    }
    if (stored && hasToken) {
      return { ...defaults[stored.role], ...stored };
    }
    if (stored && !hasToken) {
      localStorage.removeItem(STORAGE_KEY);
    }
    return { ...defaults.student, name: "Guest", email: "", backend: false };
  });

  const persist = (next: AuthUser) => {
    setUser(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const refreshFromApi = useCallback(async () => {
    // Skip /profile/ when there is no usable JWT (avoids noisy 401s)
    const token = await ensureAccessToken();
    if (!token) return;
    const apiUser = await fetchProfile();
    if (!apiUser) {
      // Stale JWT from a previous login — browse as guest without retry loops
      clearTokens();
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
      setUser({ ...defaults.student, name: "Guest", email: "", backend: false });
      return;
    }
    const base = mapApiUserToAuth(apiUser);
    const profileIds = await fetchRoleProfileIds(base.role);
    persist({ ...mapApiUserToAuth(apiUser, profileIds), backend: true });
    emitAuthChanged();
  }, []);

  useEffect(() => {
    void refreshFromApi();
  }, [refreshFromApi]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isTeacher: user.role === "teacher",
      isAdmin: user.role === "admin",
      isStudent: user.role === "student",
      signIn: async (email, password) => {
        const api = await apiLogin(email, password);
        const profileIds = await fetchRoleProfileIds(normalizeApiRole(api.user.role));
        const mapped: AuthUser = {
          ...mapApiUserToAuth(api.user, profileIds),
          backend: true,
          mustChangePassword: Boolean(
            api.must_change_password ?? api.user.must_change_password,
          ),
        };
        rememberEmailRole(mapped.email, mapped.role);
        persist(mapped);
        emitAuthChanged();
        return mapped;
      },
      signUp: async () => {
        throw new ApiError(
          "Public registration is disabled. Ask an administrator to create your account.",
          403,
        );
      },
      updateProfile: async (patch) => {
        if (getAccessToken()) {
          const apiUser = await apiUpdateProfile({
            name: patch.name,
            email: patch.email,
            phone: patch.phone,
            title: patch.title,
            bio: patch.bio,
            location: patch.location,
            avatar_url: patch.avatar,
          });
          if (apiUser) {
            const base = mapApiUserToAuth(apiUser);
            const profileIds = await fetchRoleProfileIds(base.role);
            const mapped = {
              ...mapApiUserToAuth(apiUser, {
                studentId: profileIds?.studentId || user.studentId,
                teacherName: profileIds?.teacherName || user.teacherName || patch.name,
              }),
              backend: true,
            };
            persist(mapped);
            emitAuthChanged();
            return mapped;
          }
        }
        const next = {
          ...user,
          ...patch,
          role: user.role,
          teacherName:
            user.role === "teacher" ? (patch.name || user.teacherName || user.name) : user.teacherName,
          studentId: user.studentId,
        };
        persist(next);
        return next;
      },
      signOut: async () => {
        await apiLogout();
        localStorage.removeItem(STORAGE_KEY);
        setUser(defaults.admin);
        emitAuthChanged();
      },
      refreshFromApi,
    }),
    [user, refreshFromApi],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
