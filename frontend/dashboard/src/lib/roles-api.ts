/**
 * roles/permissions API client (frontend RBAC).
 *
 * Backend:
 * - GET  /roles/permissions/
 * - GET  /roles/roles/
 * - GET  /roles/<role>/permissions/
 * - PATCH /roles/<role>/permissions/
 * - POST /roles/roles/:id/assign-permissions/
 * - GET  /roles/user-roles/?user=:id
 */

import { apiGet, apiList, apiMutateDetailed } from "@/lib/dashboard-api";
import { rolesEndpoints } from "@/lib/api-endpoints";

export type PermissionRow = {
  id: number;
  codename: string;
  name: string;
  module: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
};

export type RoleRow = {
  id: number;
  name: string;
  description?: string;
  permissions: PermissionRow[];
  permission_count?: number;
  is_system?: boolean;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type UserRoleRow = {
  id: number;
  user?: number;
  role: number;
  role_name: string;
  assigned_at?: string;
};

export async function fetchAvailablePermissions(): Promise<PermissionRow[]> {
  return apiList<PermissionRow>(rolesEndpoints.permissions());
}

export async function fetchRolesWithPermissions(): Promise<RoleRow[]> {
  return apiList<RoleRow>(rolesEndpoints.roles());
}

export async function fetchUserRoles(userId: string | number): Promise<UserRoleRow[]> {
  return apiList<UserRoleRow>(rolesEndpoints.userRolesForUser(userId));
}

export type MatrixAction = "create" | "view" | "update" | "delete";

export type PermissionMatrixModule = {
  code: string;
  name: string;
  description?: string;
  actions: Partial<Record<MatrixAction, boolean>>;
};

export type UserPermissionMatrixModule = PermissionMatrixModule & {
  overridden: Partial<Record<MatrixAction, boolean>>;
};

export type PermissionMatrix = {
  role: string;
  role_id: number;
  description?: string;
  enabled_count?: number;
  total_count?: number;
  modules: PermissionMatrixModule[];
};

export type UserPermissionMatrix = {
  user_id: string | number;
  description?: string;
  modules: UserPermissionMatrixModule[];
};

export type BackendMatrixModulePayload = {
  module: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
};

const MATRIX_ACTION_KEYS: MatrixAction[] = ["create", "view", "update", "delete"];

/** Modules hidden from the admin permission matrix UI (frontend-only). */
export const HIDDEN_MATRIX_MODULES = new Set([
  "cms",
  "seo",
  "attendance",
  "fees",
  "roles",
]);

export function isHiddenMatrixModule(code: string): boolean {
  return HIDDEN_MATRIX_MODULES.has(String(code || "").trim().toLowerCase());
}

export function filterVisibleMatrixModules<T extends { code: string }>(modules: T[]): T[] {
  return modules.filter((m) => !isHiddenMatrixModule(m.code));
}

export function partitionMatrixModules<T extends { code: string }>(modules: T[]): {
  visible: T[];
  hidden: T[];
} {
  const visible: T[] = [];
  const hidden: T[] = [];
  for (const m of modules) {
    if (isHiddenMatrixModule(m.code)) hidden.push(m);
    else visible.push(m);
  }
  return { visible, hidden };
}

function getBool(v: unknown): boolean {
  return typeof v === "boolean" ? v : false;
}

/** Map UI matrix rows to the backend PATCH contract: { module, can_view, can_create, can_edit, can_delete }. */
export function toBackendMatrixModulePayload(
  m: Pick<PermissionMatrixModule, "code" | "actions">,
): BackendMatrixModulePayload {
  return {
    module: m.code,
    can_view: getBool(m.actions.view),
    can_create: getBool(m.actions.create),
    can_edit: getBool(m.actions.update),
    can_delete: getBool(m.actions.delete),
  };
}

export function toBackendMatrixPayload(
  modules: Array<Pick<PermissionMatrixModule, "code" | "actions">>,
): BackendMatrixModulePayload[] {
  return modules.map(toBackendMatrixModulePayload);
}

/**
 * Ensure every matrix row has a stable UI shape.
 *
 * The backend may return either:
 * 1) { code, name, actions: { create/view/update/delete } }
 * 2) { module, label, can_create/can_view/can_edit/can_delete }
 *
 * The UI always works with { code, name, actions: { create/view/update/delete } }.
 */
export function normalizeMatrixModules(raw: unknown): PermissionMatrixModule[] {
  if (!Array.isArray(raw)) return [];
  const normalized: PermissionMatrixModule[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;

    const code = String(row.code ?? row.module ?? "").trim();
    if (!code) continue;

    const name = String(row.name ?? row.label ?? code);

    const description =
      row.description != null && String(row.description).trim() ? String(row.description) : undefined;

    // Prefer the explicit `{ actions: ... }` shape when present.
    const rawActions =
      row.actions != null && typeof row.actions === "object" && !Array.isArray(row.actions)
        ? (row.actions as Record<string, unknown>)
        : null;

    const actions: Partial<Record<MatrixAction, boolean>> = {};

    if (rawActions) {
      for (const key of MATRIX_ACTION_KEYS) {
        const value = rawActions[key];
        if (typeof value === "boolean") {
          actions[key] = value;
        } else if (key === "update" && typeof rawActions.edit === "boolean") {
          actions[key] = rawActions.edit;
        }
      }
    } else {
      // Fallback to `{ can_* }` flags.
      if (typeof row.can_create === "boolean") actions.create = row.can_create;
      if (typeof row.can_view === "boolean") actions.view = row.can_view;
      if (typeof row.can_edit === "boolean") actions.update = row.can_edit;
      if (typeof row.can_delete === "boolean") actions.delete = row.can_delete;
    }

    normalized.push({ code, name, description, actions });
  }
  return normalized;
}

function extractOverrideFlag(row: Record<string, unknown>, action: MatrixAction): boolean | undefined {
  // Backend may use any of these patterns for "is this action individually overridden?"
  // We accept multiple shapes to be resilient to backend serializer differences.
  const canSuffix = action === "update" ? "edit" : action; // update => can_edit; others => can_create/can_view/can_delete

  const boolDirectCandidates = [
    row[`overridden_${canSuffix}`],
    row[`is_overridden_${canSuffix}`],
    row[`override_${canSuffix}`],
    row[`overridden_${action}`],
    row[`is_overridden_${action}`],
    row[`override_${action}`],
  ];
  for (const c of boolDirectCandidates) {
    if (typeof c === "boolean") return c;
  }

  const inheritedCandidates = [
    row[`inherited_${canSuffix}`],
    row[`is_inherited_${canSuffix}`],
    row[`inherited_${action}`],
    row[`is_inherited_${action}`],
  ];
  for (const c of inheritedCandidates) {
    if (typeof c === "boolean") return !c;
  }

  const sourceCandidates = [
    row[`source_${canSuffix}`],
    row[`override_source_${canSuffix}`],
    row[`source_${action}`],
    row[`override_source_${action}`],
  ];
  for (const s of sourceCandidates) {
    if (typeof s === "string") {
      const v = s.toLowerCase().trim();
      if (v === "override" || v === "overridden" || v === "individual" || v === "custom") return true;
      if (v === "inherit" || v === "inherited" || v === "role") return false;
    }
  }

  // Nested overrides/source objects
  const overrides = row.overrides;
  if (overrides && typeof overrides === "object" && !Array.isArray(overrides)) {
    const o = overrides as Record<string, unknown>;
    const direct =
      o[action] ??
      o[canSuffix] ??
      o[`overridden_${canSuffix}`] ??
      o[`overridden_${action}`] ??
      o[`override_${canSuffix}`] ??
      o[`override_${action}`];
    if (typeof direct === "boolean") return direct;
  }

  return undefined;
}

export function normalizeUserMatrixModules(raw: unknown): UserPermissionMatrixModule[] {
  if (!Array.isArray(raw)) return [];
  const normalized: UserPermissionMatrixModule[] = [];

  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;

    const code = String(row.code ?? row.module ?? "").trim();
    if (!code) continue;

    const name = String(row.name ?? row.label ?? code);
    const description =
      row.description != null && String(row.description).trim() ? String(row.description) : undefined;

    // Effective values
    const actions: Partial<Record<MatrixAction, boolean>> = {};
    const rawActions =
      row.actions != null && typeof row.actions === "object" && !Array.isArray(row.actions)
        ? (row.actions as Record<string, unknown>)
        : null;

    if (rawActions) {
      for (const key of MATRIX_ACTION_KEYS) {
        const value = rawActions[key];
        if (typeof value === "boolean") actions[key] = value;
        else if (key === "update" && typeof rawActions.edit === "boolean") actions[key] = rawActions.edit;
      }
    } else {
      if (typeof row.can_create === "boolean") actions.create = row.can_create;
      if (typeof row.can_view === "boolean") actions.view = row.can_view;
      if (typeof row.can_edit === "boolean") actions.update = row.can_edit;
      if (typeof row.can_delete === "boolean") actions.delete = row.can_delete;
    }

    const overridden: Partial<Record<MatrixAction, boolean>> = {};
    for (const action of MATRIX_ACTION_KEYS) {
      const ov = extractOverrideFlag(row, action);
      if (typeof ov === "boolean") overridden[action] = ov;
    }

    normalized.push({ code, name, description, actions, overridden });
  }

  return normalized;
}

function normalizePermissionMatrix(data: PermissionMatrix | null): PermissionMatrix | null {
  if (!data) return null;
  const anyData = data as unknown as { modules?: unknown; data?: { modules?: unknown; role?: string; role_id?: number } };
  const modulesRaw = anyData.modules ?? anyData.data?.modules;

  return {
    ...data,
    // Some environments may return modules under an extra `data` key.
    modules: normalizeMatrixModules(modulesRaw),
    // Keep the returned shape stable even if role_id is missing in some responses.
    role_id: (data as unknown as { role_id?: number }).role_id ?? anyData.data?.role_id ?? 0,
  };
}

export async function fetchRolePermissionMatrix(
  role: string | number,
): Promise<PermissionMatrix | null> {
  const data = await apiGet<PermissionMatrix>(rolesEndpoints.rolePermissions(role));
  return normalizePermissionMatrix(data);
}

export async function fetchUserPermissionMatrix(
  userId: string | number,
): Promise<UserPermissionMatrix | null> {
  const data = await apiGet<UserPermissionMatrix>(rolesEndpoints.userPermissions(userId));
  if (!data) return null;
  const anyData = data as unknown as { modules?: unknown; data?: { modules?: unknown }; user_id?: string | number };
  const modulesRaw = anyData.modules ?? anyData.data?.modules;

  return {
    user_id: (anyData.user_id ?? userId) as string | number,
    description: (data as unknown as { description?: string }).description,
    modules: normalizeUserMatrixModules(modulesRaw),
  };
}

/** Self-service matrix for the logged-in user (GET /users/me/permissions/). */
export async function fetchCurrentUserPermissionMatrix(): Promise<UserPermissionMatrix | null> {
  const data = await apiGet<UserPermissionMatrix>(rolesEndpoints.currentUserPermissions());
  if (!data) return null;
  const anyData = data as unknown as { modules?: unknown; data?: { modules?: unknown }; user_id?: string | number };
  const modulesRaw = anyData.modules ?? anyData.data?.modules;

  return {
    user_id: (anyData.user_id ?? 0) as string | number,
    description: (data as unknown as { description?: string }).description,
    modules: normalizeUserMatrixModules(modulesRaw),
  };
}


export async function saveUserPermissionMatrix(
  userId: string | number,
  modules: UserPermissionMatrixModule[],
): Promise<{ data: UserPermissionMatrix | null; error: string | null }> {
  const result = await apiMutateDetailed<UserPermissionMatrix>(
    rolesEndpoints.userPermissions(userId),
    "PATCH",
    { modules: toBackendMatrixPayload(modules) },
  );
  if (!result.data) return { data: null, error: result.error };
  const anyData = result.data as unknown as {
    modules?: unknown;
    data?: { modules?: unknown };
    user_id?: string | number;
  };
  const modulesRaw = anyData.modules ?? anyData.data?.modules;
  return {
    data: {
      user_id: anyData.user_id ?? userId,
      modules: normalizeUserMatrixModules(modulesRaw),
    } as UserPermissionMatrix,
    error: result.error,
  };
}

export async function saveRolePermissionMatrix(
  role: string | number,
  modules: PermissionMatrixModule[],
): Promise<{ data: PermissionMatrix | null; error: string | null }> {
  const result = await apiMutateDetailed<PermissionMatrix>(
    rolesEndpoints.rolePermissions(role),
    "PATCH",
    { modules: toBackendMatrixPayload(modules) },
  );
  return { data: normalizePermissionMatrix(result.data), error: result.error };
}

export async function assignPermissionsToRole(
  roleId: string | number,
  permissionIds: number[],
): Promise<RoleRow | null> {
  const result = await apiMutateDetailed<RoleRow>(rolesEndpoints.assignPermissions(roleId), "POST", {
    permission_ids: permissionIds,
  });
  if (!result.data) return null;
  return result.data;
}

export function matrixModulesToPermissionCodenames(
  modules: Array<Pick<PermissionMatrixModule, "code" | "actions">>,
): string[] {
  const codenames = new Set<string>();
  for (const m of modules) {
    for (const action of MATRIX_ACTION_KEYS) {
      if (m.actions[action] === true) codenames.add(`${m.code}.${action}`);
    }
  }
  return [...codenames.values()];
}

export async function fetchPermissionsForCurrentAuthUser(): Promise<string[]> {
  const matrix = await fetchCurrentUserPermissionMatrix();
  if (!matrix?.modules?.length) return [];
  return matrixModulesToPermissionCodenames(matrix.modules);
}

