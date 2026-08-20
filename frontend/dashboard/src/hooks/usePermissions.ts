import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/dashboard/AuthContext";
import { fetchPermissionsForCurrentAuthUser } from "@/lib/roles-api";

const PERMISSION_REFRESH_KEY = "shikshalab_permissions_refresh";

export type PermissionsState = {
  permissions: Set<string>;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
};

export function usePermissions(): PermissionsState {
  const { user, authReady } = useAuth();
  const qc = useQueryClient();

  const queryKey = useMemo(() => ["permissions", user.email, user.role], [user.email, user.role]);
  const query = useQuery({
    queryKey,
    enabled: authReady && Boolean(user.email),
    queryFn: async () => {
      const perms = await fetchPermissionsForCurrentAuthUser();
      return perms;
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
    retry: 1,
  });

  const permissions = useMemo(() => new Set<string>(query.data || []), [query.data]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== PERMISSION_REFRESH_KEY) return;
      void qc.invalidateQueries({ queryKey });
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [qc, queryKey]);

  return {
    permissions,
    loading: query.isLoading || query.isFetching,
    error: query.isError ? String(query.error) : null,
    refresh: async () => {
      await qc.invalidateQueries({ queryKey });
    },
    hasPermission: (permission: string) => permissions.has(permission),
  };
}

