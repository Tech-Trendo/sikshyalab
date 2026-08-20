import type { ReactNode } from "react";
import { usePermissions } from "@/hooks/usePermissions";

export function Can({ permission, children }: { permission: string; children: ReactNode }) {
  const { hasPermission } = usePermissions();
  if (!hasPermission(permission)) return null;
  return <>{children}</>;
}

