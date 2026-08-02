import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Role } from "@/components/dashboard/AuthContext";
import { useAuth } from "@/components/dashboard/AuthContext";
import {
  archiveNotification,
  deleteNotification,
  fetchNotifications,
  getAccessToken,
  mapApiNotification,
  markAllNotificationsRead,
  markNotificationRead,
  resolveNotificationsWsUrl,
  type ApiNotification,
} from "@/lib/api";
import { toast } from "sonner";

export type AppNotification = {
  id: string;
  title: string;
  body: string;
  href?: string;
  kind: "info" | "success" | "warning" | "assignment" | "fee" | "system";
  read: boolean;
  archived?: boolean;
  priority?: "critical" | "high" | "medium" | "low";
  category?: string;
  eventCode?: string;
  createdAt: string;
};

type NotificationsContextValue = {
  notifications: AppNotification[];
  unreadCount: number;
  markRead: (id: string) => void;
  markAllRead: () => void;
  archive: (id: string) => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
  addNotification: (n: Omit<AppNotification, "id" | "createdAt" | "read"> & { read?: boolean }) => void;
  refresh: () => Promise<void>;
  connected: boolean;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

function storageKey(role: Role, email: string) {
  return `shikshalab_notifications_${role}_${email}`;
}

function loadLocal(role: Role, email: string): AppNotification[] {
  try {
    const raw = localStorage.getItem(storageKey(role, email));
    if (raw) return JSON.parse(raw) as AppNotification[];
  } catch {
    /* ignore */
  }
  return [];
}

function maybeBrowserNotify(n: AppNotification) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  if (n.priority !== "critical" && n.priority !== "high") return;
  try {
    new Notification(n.title, { body: n.body, tag: n.id });
  } catch {
    /* ignore */
  }
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>(() =>
    typeof window === "undefined" ? [] : loadLocal(user.role, user.email),
  );
  const [useBackend, setUseBackend] = useState(false);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const refresh = useCallback(async () => {
    if (!getAccessToken()) {
      setUseBackend(false);
      setNotifications(loadLocal(user.role, user.email));
      return;
    }
    const apiList = await fetchNotifications();
    if (apiList) {
      setUseBackend(true);
      setNotifications(apiList.map(mapApiNotification));
      return;
    }
    setUseBackend(false);
    setNotifications(loadLocal(user.role, user.email));
  }, [user.role, user.email]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (useBackend) return;
    localStorage.setItem(storageKey(user.role, user.email), JSON.stringify(notifications));
  }, [notifications, user.role, user.email, useBackend]);

  // Real-time WebSocket
  useEffect(() => {
    const token = getAccessToken();
    if (!token || typeof window === "undefined") return;

    const url = resolveNotificationsWsUrl(token);
    if (!url) return;

    let closed = false;
    let retry = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      if (closed) return;
      try {
        const ws = new WebSocket(url);
        wsRef.current = ws;
        ws.onopen = () => {
          setConnected(true);
          retry = 0;
        };
        ws.onclose = () => {
          setConnected(false);
          wsRef.current = null;
          if (closed) return;
          retry += 1;
          timer = setTimeout(connect, Math.min(30_000, 1000 * 2 ** retry));
        };
        ws.onerror = () => {
          ws.close();
        };
        ws.onmessage = (ev) => {
          try {
            const data = JSON.parse(ev.data as string) as {
              event?: string;
              notification?: ApiNotification;
            };
            if (data.event === "notification.created" && data.notification) {
              const mapped = mapApiNotification(data.notification);
              setNotifications((prev) => {
                if (prev.some((p) => p.id === mapped.id)) return prev;
                return [mapped, ...prev];
              });
              setUseBackend(true);
              if (mapped.priority === "critical") {
                toast.error(mapped.title, { description: mapped.body });
              } else {
                toast.message(mapped.title, { description: mapped.body });
              }
              maybeBrowserNotify(mapped);
            }
          } catch {
            /* ignore malformed */
          }
        };
      } catch {
        setConnected(false);
      }
    };

    connect();
    return () => {
      closed = true;
      if (timer) clearTimeout(timer);
      wsRef.current?.close();
      wsRef.current = null;
      setConnected(false);
    };
  }, [user.email]);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "default") {
      void Notification.requestPermission();
    }
  }, []);

  const markRead = useCallback(
    (id: string) => {
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      if (useBackend) void markNotificationRead(id);
    },
    [useBackend],
  );

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    if (useBackend) void markAllNotificationsRead();
  }, [useBackend]);

  const archive = useCallback(
    (id: string) => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      if (useBackend) void archiveNotification(id);
    },
    [useBackend],
  );

  const removeNotification = useCallback(
    (id: string) => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      if (useBackend) void deleteNotification(id);
    },
    [useBackend],
  );

  const clearAll = useCallback(() => {
    const ids = notifications.map((n) => n.id);
    setNotifications([]);
    if (useBackend) ids.forEach((id) => void deleteNotification(id));
  }, [useBackend, notifications]);

  const addNotification = useCallback(
    (n: Omit<AppNotification, "id" | "createdAt" | "read"> & { read?: boolean }) => {
      setNotifications((prev) => [
        {
          ...n,
          id: `n-${Date.now()}`,
          createdAt: new Date().toISOString(),
          read: n.read ?? false,
        },
        ...prev,
      ]);
    },
    [],
  );

  const value = useMemo<NotificationsContextValue>(
    () => ({
      notifications,
      unreadCount: notifications.filter((n) => !n.read && !n.archived).length,
      markRead,
      markAllRead,
      archive,
      removeNotification,
      clearAll,
      addNotification,
      refresh,
      connected,
    }),
    [
      notifications,
      markRead,
      markAllRead,
      archive,
      removeNotification,
      clearAll,
      addNotification,
      refresh,
      connected,
    ],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationsProvider");
  return ctx;
}

export function formatRelativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
