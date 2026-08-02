import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/components/dashboard/AuthContext";
import {
  fetchSettings,
  getAccessToken,
  mapApiSettings,
  toApiSettings,
  updateSettings as apiUpdateSettings,
} from "@/lib/api";

export type UserSettings = {
  emailNotifications: boolean;
  assignmentAlerts: boolean;
  feeReminders: boolean;
  marketingEmails: boolean;
  digestWeekly: boolean;
  language: "en" | "ne";
  timezone: string;
  compactSidebar: boolean;
};

const DEFAULTS: UserSettings = {
  emailNotifications: true,
  assignmentAlerts: true,
  feeReminders: true,
  marketingEmails: false,
  digestWeekly: true,
  language: "en",
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata",
  compactSidebar: false,
};

type SettingsContextValue = {
  settings: UserSettings;
  updateSettings: (patch: Partial<UserSettings>) => void;
  saveSettings: (patch?: Partial<UserSettings>) => Promise<UserSettings>;
  resetSettings: () => void;
  refresh: () => Promise<void>;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

function key(email: string) {
  return `shikshalab_settings_${email}`;
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<UserSettings>(() => {
    if (typeof window === "undefined") return DEFAULTS;
    try {
      const raw = localStorage.getItem(key(user.email));
      if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
    } catch { /* ignore */ }
    return DEFAULTS;
  });
  const [useBackend, setUseBackend] = useState(false);

  const refresh = useCallback(async () => {
    if (!getAccessToken()) {
      setUseBackend(false);
      try {
        const raw = localStorage.getItem(key(user.email));
        setSettings(raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS);
      } catch {
        setSettings(DEFAULTS);
      }
      return;
    }
    const api = await fetchSettings();
    if (api) {
      setUseBackend(true);
      setSettings(mapApiSettings(api));
      return;
    }
    setUseBackend(false);
  }, [user.email]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (useBackend) return;
    localStorage.setItem(key(user.email), JSON.stringify(settings));
  }, [settings, user.email, useBackend]);

  const updateSettings = useCallback((patch: Partial<UserSettings>) => {
    setSettings((s) => ({ ...s, ...patch }));
  }, []);

  const saveSettings = useCallback(
    async (patch?: Partial<UserSettings>) => {
      const next = { ...settings, ...(patch || {}) };
      setSettings(next);
      if (getAccessToken()) {
        const api = await apiUpdateSettings(toApiSettings(next));
        if (api) {
          setUseBackend(true);
          const mapped = mapApiSettings(api);
          setSettings(mapped);
          return mapped;
        }
      }
      localStorage.setItem(key(user.email), JSON.stringify(next));
      return next;
    },
    [settings, user.email],
  );

  const resetSettings = useCallback(() => {
    setSettings(DEFAULTS);
    if (useBackend) void apiUpdateSettings(toApiSettings(DEFAULTS));
    else localStorage.setItem(key(user.email), JSON.stringify(DEFAULTS));
  }, [useBackend, user.email]);

  const value = useMemo<SettingsContextValue>(
    () => ({
      settings,
      updateSettings,
      saveSettings,
      resetSettings,
      refresh,
    }),
    [settings, updateSettings, saveSettings, resetSettings, refresh],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
