import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  apiLogin,
  apiLogout,
  clearTokens,
  fetchProfile,
  getAccessToken,
  fetchRoleProfileIds,
  mapApiUserToAuth,
  updateProfile as apiUpdateProfile,
  uploadProfileAvatar,
} from "@/lib/api";
import { emitAuthChanged, AUTH_CHANGED } from "@/lib/auth-events";
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
  teacherName?: string;
  studentId?: string;
  backend?: boolean;
  mustChangePassword?: boolean;
};

const STORAGE_KEY = "shikshalab_auth";

/** Neutral empty session — never invent a guest student identity. */
const EMPTY_USER: AuthUser = {
  name: "",
  email: "",
  role: "admin",
  backend: false,
};

function readStored(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthUser;
    if (!parsed?.email || !parsed?.role) return null;
    return parsed;
  } catch {
    return null;
  }
}

function hydrateFromStorage(): AuthUser {
  const stored = readStored();
  const hasToken = Boolean(getAccessToken());
  if (stored?.backend === false && stored.email) {
    if (hasToken) clearTokens();
    return { ...stored, backend: false };
  }
  if (stored && hasToken) {
    return { ...stored, backend: stored.backend !== false };
  }
  if (stored && !hasToken) {
    // Keep stored identity briefly if refresh may restore the token session
    // but without a token we treat as signed out.
    localStorage.removeItem(STORAGE_KEY);
  }
  return EMPTY_USER;
}

type AuthContextValue = {
  user: AuthUser;
  /** False until client has read localStorage (prevents guest flash after SSR). */
  authReady: boolean;
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
  uploadAvatar: (file: File) => Promise<AuthUser>;
  signOut: () => Promise<void>;
  refreshFromApi: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Same initial state on server + client to avoid hydration mismatch.
  // Session is applied in useLayoutEffect after mount.
  const [user, setUser] = useState<AuthUser>(EMPTY_USER);
  const [authReady, setAuthReady] = useState(false);

  const persist = (next: AuthUser) => {
    setUser(next);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
  };

  const refreshFromApi = async () => {
    if (!getAccessToken()) return;
    const apiUser = await fetchProfile();
    if (!apiUser) return;
    const base = mapApiUserToAuth(apiUser);
    const profileIds = await fetchRoleProfileIds(base.role);
    persist({ ...mapApiUserToAuth(apiUser, profileIds), backend: true });
    emitAuthChanged();
  };

  // Hydrate from localStorage after mount (matches SSR empty shell → client layout).
  useLayoutEffect(() => {
    const next = hydrateFromStorage();
    setUser(next);
    setAuthReady(true);
    if (getAccessToken()) {
      void refreshFromApi();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const syncFromStorage = () => {
      setUser(hydrateFromStorage());
    };

    window.addEventListener("storage", syncFromStorage);
    window.addEventListener(AUTH_CHANGED, syncFromStorage);
    return () => {
      window.removeEventListener("storage", syncFromStorage);
      window.removeEventListener(AUTH_CHANGED, syncFromStorage);
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      authReady,
      isTeacher: user.role === "teacher",
      isAdmin: user.role === "admin",
      isStudent: user.role === "student",
      signIn: async (email, password) => {
        const api = await apiLogin(email, password);
        if (api?.user) {
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
        }
        throw new ApiError("Invalid email or password", 401);
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
            const profileIds = await fetchRoleProfileIds(mapApiUserToAuth(apiUser).role);
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
      uploadAvatar: async (file: File) => {
        if (!getAccessToken()) {
          throw new ApiError("Sign in required to upload a profile picture", 401);
        }
        const apiUser = await uploadProfileAvatar(file);
        if (!apiUser) {
          throw new ApiError("Could not upload profile picture", 400);
        }
        const profileIds = await fetchRoleProfileIds(mapApiUserToAuth(apiUser).role);
        const mapped = {
          ...mapApiUserToAuth(apiUser, {
            studentId: profileIds?.studentId || user.studentId,
            teacherName: profileIds?.teacherName || user.teacherName,
          }),
          backend: true,
        };
        persist(mapped);
        emitAuthChanged();
        return mapped;
      },
      signOut: async () => {
        await apiLogout();
        localStorage.removeItem(STORAGE_KEY);
        setUser(EMPTY_USER);
        emitAuthChanged();
      },
      refreshFromApi,
    }),
    [user, authReady],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
