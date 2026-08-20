import { PageHeader } from "@/components/dashboard/DashboardLayout";
import { useAuth } from "@/components/dashboard/AuthContext";
import {
  fetchRolePermissionMatrix,
  fetchRolesWithPermissions,
  fetchUserPermissionMatrix,
  partitionMatrixModules,
  saveRolePermissionMatrix,
  saveUserPermissionMatrix,
  type MatrixAction,
  type PermissionMatrixModule,
  type RoleRow,
  type UserPermissionMatrixModule,
} from "@/lib/roles-api";
import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Pencil, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { teacherEndpoints } from "@/lib/api-endpoints";
import { apiList, type ApiTeacherRow } from "@/lib/dashboard-api";
import { useDirtyForm } from "@/hooks/useDirtyForm";

const PERMISSION_REFRESH_KEY = "shikshalab_permissions_refresh";
const MANAGED_ROLES = ["Teacher"] as const;
const MATRIX_ACTIONS: { key: MatrixAction; label: string }[] = [
  { key: "create", label: "Create" },
  { key: "view", label: "View" },
  { key: "update", label: "Edit" },
  { key: "delete", label: "Delete" },
];

function CircleToggle({
  checked,
  onToggle,
  label,
  disabled,
  overridden,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
  disabled?: boolean;
  overridden?: boolean;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "relative mx-auto grid h-7 w-7 place-content-center rounded-full border transition-colors",
        disabled && "cursor-not-allowed opacity-30",
        checked
          ? "border-primary bg-primary text-primary-foreground"
          : "border-muted-foreground/40 bg-transparent text-transparent hover:border-primary/70",
        overridden && "ring-2 ring-amber-500/50",
      )}
    >
      <Check className="h-3.5 w-3.5" strokeWidth={3} />
      {overridden ? (
        <span className="pointer-events-none absolute -bottom-1 -right-1 h-2 w-2 rounded-full bg-amber-500" />
      ) : null}
    </button>
  );
}

function countEnabled(modules: PermissionMatrixModule[]) {
  let enabled = 0;
  let total = 0;
  for (const row of modules) {
    const actions = row?.actions;
    if (!actions || typeof actions !== "object") continue;
    for (const { key } of MATRIX_ACTIONS) {
      if (typeof actions[key] === "boolean") {
        total += 1;
        if (actions[key]) enabled += 1;
      }
    }
  }
  return { enabled, total };
}

function allRowEnabled(row: PermissionMatrixModule) {
  const actions = row?.actions;
  if (!actions || typeof actions !== "object") return false;
  const keys = MATRIX_ACTIONS.map((a) => a.key).filter((k) => typeof actions[k] === "boolean");
  return keys.length > 0 && keys.every((k) => actions[k]);
}

export function RolesPermissionsPage() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [rolesLoading, setRolesLoading] = useState(true);
  const [roles, setRoles] = useState<RoleRow[]>([]);

  const [editing, setEditing] = useState<RoleRow | null>(null);
  const [matrixLoading, setMatrixLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modules, setModules] = useState<PermissionMatrixModule[]>([]);
  const roleHiddenModulesRef = useRef<PermissionMatrixModule[]>([]);

  const [teachersLoading, setTeachersLoading] = useState(false);
  const [teachers, setTeachers] = useState<ApiTeacherRow[]>([]);
  const [teacherQuery, setTeacherQuery] = useState("");

  const [userEditing, setUserEditing] = useState<{ userId: string | number; name: string } | null>(null);
  const [userMatrixLoading, setUserMatrixLoading] = useState(false);
  const [userSaving, setUserSaving] = useState(false);
  const [userModules, setUserModules] = useState<UserPermissionMatrixModule[]>([]);
  const [userBaseline, setUserBaseline] = useState<UserPermissionMatrixModule[] | null>(null);
  const teacherDefaultsRef = useRef<Map<string, Partial<Record<MatrixAction, boolean>>>>(new Map());

  const userDirty = useDirtyForm(userModules, userBaseline, Boolean(userEditing));
  const { enabled: userEnabled, total: userTotal } = useMemo(
    () => (userEditing && !userMatrixLoading ? countEnabled(userModules) : { enabled: 0, total: 0 }),
    [userEditing, userMatrixLoading, userModules],
  );

  const visibleRoles = useMemo(() => {
    const byName = new Map(roles.map((r) => [r.name.trim().toLowerCase(), r]));
    return MANAGED_ROLES.map((name) => {
      const match = byName.get(name.toLowerCase());
      return {
        name,
        description:
          match?.description || "Manage assigned courses, batches, content, and assignments.",
        role: match || null,
      };
    });
  }, [roles]);

  const { enabled, total } = useMemo(
    () => (editing && !matrixLoading ? countEnabled(modules) : { enabled: 0, total: 0 }),
    [editing, matrixLoading, modules],
  );

  const getTeacherDisplayName = (t: ApiTeacherRow) => {
    const fullName = (t as any).full_name as string | undefined;
    const userFirst = (t as any).user?.first_name as string | undefined;
    const userLast = (t as any).user?.last_name as string | undefined;
    return (fullName || [userFirst, userLast].filter(Boolean).join(" ").trim() || "Instructor") as string;
  };

  const getTeacherUserId = (t: ApiTeacherRow): string | number | null => {
    const uid = (t as any).user?.id;
    if (uid === undefined || uid === null || uid === "") return null;
    return uid as string | number;
  };

  useEffect(() => {
    if (!isAdmin) {
      setRolesLoading(false);
      return;
    }
    let cancelled = false;
    const loadRoles = async () => {
      setRolesLoading(true);
      try {
        const list = await fetchRolesWithPermissions();
        if (cancelled) return;
        setRoles(list);
        if (!list.length) toast.error("No roles returned from backend");
      } catch {
        if (!cancelled) toast.error("Could not load roles");
      } finally {
        if (!cancelled) setRolesLoading(false);
      }
    };
    void loadRoles();
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) {
      setTeachersLoading(false);
      setTeachers([]);
      return;
    }
    let cancelled = false;
    const loadTeachers = async () => {
      setTeachersLoading(true);
      try {
        const list = await apiList<ApiTeacherRow>(teacherEndpoints.list());
        if (cancelled) return;
        setTeachers(list);
      } catch {
        if (!cancelled) toast.error("Could not load teachers");
      } finally {
        if (!cancelled) setTeachersLoading(false);
      }
    };
    void loadTeachers();
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  const filteredTeachers = useMemo(() => {
    const q = teacherQuery.trim().toLowerCase();
    if (!q) return teachers;
    return teachers.filter((t) => {
      const name = getTeacherDisplayName(t).toLowerCase();
      const email = ((t as any).user?.email as string | undefined)?.toLowerCase() || "";
      return name.includes(q) || email.includes(q);
    });
  }, [teacherQuery, teachers]);

  const openEdit = async (row: (typeof visibleRoles)[number]) => {
    if (!row.role) {
      toast.error(`${row.name} role was not found on the backend`);
      return;
    }
    setEditing(row.role);
    setMatrixLoading(true);
    setModules([]);
    roleHiddenModulesRef.current = [];
    const matrix = await fetchRolePermissionMatrix(row.role.name);
    setMatrixLoading(false);
    if (!matrix) {
      toast.error(`Could not load permissions for ${row.name}`);
      setEditing(null);
      return;
    }
    const { visible, hidden } = partitionMatrixModules(matrix.modules || []);
    roleHiddenModulesRef.current = hidden;
    setModules(visible);
  };

  const closeModal = () => {
    if (saving) return;
    setEditing(null);
    setModules([]);
    roleHiddenModulesRef.current = [];
  };

  const closeUserModal = () => {
    if (userSaving) return;
    setUserEditing(null);
    setUserModules([]);
    setUserBaseline(null);
    teacherDefaultsRef.current = new Map();
  };

  const openUserEdit = async (teacher: ApiTeacherRow) => {
    const userId = getTeacherUserId(teacher);
    const teacherName = getTeacherDisplayName(teacher);
    if (!userId) {
      toast.error("Selected teacher has no user id for permission overrides");
      return;
    }

    setUserEditing({ userId, name: teacherName });
    setUserMatrixLoading(true);
    setUserSaving(false);
    setUserModules([]);
    setUserBaseline(null);
    teacherDefaultsRef.current = new Map();

    try {
      // Role defaults are needed to support "revert to inherit".
      const roleMatrix = await fetchRolePermissionMatrix("Teacher");
      if (!roleMatrix) {
        toast.error("Could not load Teacher role defaults");
        setUserEditing(null);
        return;
      }
      const defaults = new Map<string, Partial<Record<MatrixAction, boolean>>>();
      for (const m of partitionMatrixModules(roleMatrix.modules).visible) {
        defaults.set(m.code, m.actions);
      }
      teacherDefaultsRef.current = defaults;

      const matrix = await fetchUserPermissionMatrix(userId);
      if (!matrix) {
        toast.error(`Could not load permissions for ${teacherName}`);
        setUserEditing(null);
        return;
      }

      let modules = partitionMatrixModules(matrix.modules || []).visible;

      // Fallback: if the backend didn't send explicit override flags, infer them
      // by comparing effective values vs role defaults.
      modules = modules.map((m) => {
        const overridden = { ...(m.overridden || {}) };
        for (const { key } of MATRIX_ACTIONS) {
          const defVal = defaults.get(m.code)?.[key] ?? false;
          const effVal = m.actions?.[key];
          if (typeof effVal !== "boolean") continue;
          if (typeof overridden[key] !== "boolean") overridden[key] = effVal !== defVal;
        }
        return { ...m, overridden };
      });

      setUserModules(modules);
      setUserBaseline(modules);
    } catch {
      toast.error("Could not load permission matrix");
      setUserEditing(null);
    } finally {
      setUserMatrixLoading(false);
    }
  };

  const getTeacherDefaultVal = (code: string, key: MatrixAction) =>
    teacherDefaultsRef.current.get(code)?.[key] ?? false;

  const setUserAction = (code: string, key: MatrixAction, value: boolean) => {
    const defVal = getTeacherDefaultVal(code, key);
    setUserModules((prev) =>
      prev.map((row) =>
        row.code === code
          ? {
              ...row,
              actions: { ...row.actions, [key]: value },
              overridden: { ...(row.overridden || {}), [key]: value !== defVal },
            }
          : row,
      ),
    );
  };

  const toggleRowAllUser = (row: UserPermissionMatrixModule) => {
    const next = !allRowEnabled(row);
    setUserModules((prev) =>
      prev.map((item) => {
        if (item.code !== row.code) return item;
        const actions = { ...item.actions };
        const overridden = { ...(item.overridden || {}) };
        for (const { key } of MATRIX_ACTIONS) {
          if (typeof actions[key] !== "boolean") continue;
          actions[key] = next;
          overridden[key] = next !== getTeacherDefaultVal(item.code, key);
        }
        return { ...item, actions, overridden };
      }),
    );
  };

  const grantAllUser = () => {
    setUserModules((prev) =>
      prev.map((row) => {
        const actions = { ...row.actions };
        const overridden = { ...(row.overridden || {}) };
        for (const { key } of MATRIX_ACTIONS) {
          if (typeof actions[key] !== "boolean") continue;
          actions[key] = true;
          overridden[key] = true !== getTeacherDefaultVal(row.code, key);
        }
        return { ...row, actions, overridden };
      }),
    );
  };

  const revokeAllUser = () => {
    setUserModules((prev) =>
      prev.map((row) => {
        const actions = { ...row.actions };
        const overridden = { ...(row.overridden || {}) };
        for (const { key } of MATRIX_ACTIONS) {
          if (typeof actions[key] !== "boolean") continue;
          actions[key] = false;
          overridden[key] = false !== getTeacherDefaultVal(row.code, key);
        }
        return { ...row, actions, overridden };
      }),
    );
  };

  const revertUserAction = (code: string, key: MatrixAction) => {
    const defVal = getTeacherDefaultVal(code, key);
    setUserModules((prev) =>
      prev.map((row) =>
        row.code === code
          ? {
              ...row,
              actions: { ...row.actions, [key]: defVal },
              overridden: { ...(row.overridden || {}), [key]: false },
            }
          : row,
      ),
    );
  };

  const saveUser = async () => {
    if (!userEditing || !userBaseline) return;

    const baseline = userBaseline;
    const current = userModules;

    const changedModules: UserPermissionMatrixModule[] = [];

    for (const cur of current) {
      const base = baseline.find((b) => b.code === cur.code);
      if (!base) continue;

      let moduleChanged = false;
      for (const { key } of MATRIX_ACTIONS) {
        const baseVal = base.actions[key];
        const curVal = cur.actions[key];
        if (typeof baseVal !== "boolean" || typeof curVal !== "boolean") continue;

        const baseDef = getTeacherDefaultVal(cur.code, key);
        const baseOver =
          typeof base.overridden?.[key] === "boolean" ? base.overridden[key] : baseVal !== baseDef;
        const curOver =
          typeof cur.overridden?.[key] === "boolean" ? cur.overridden[key] : curVal !== baseDef;

        if (baseVal !== curVal || baseOver !== curOver) {
          moduleChanged = true;
          break;
        }
      }

      if (moduleChanged) changedModules.push(cur);
    }

    if (changedModules.length === 0) {
      toast.success("No permission changes to save");
      return;
    }

    setUserSaving(true);
    try {
      const result = await saveUserPermissionMatrix(userEditing.userId, changedModules);
      if (!result.data) {
        toast.error(result.error || "Could not save permissions");
        return;
      }
      toast.success("Teacher permissions saved");

      try {
        localStorage.setItem(PERMISSION_REFRESH_KEY, String(Date.now()));
      } catch {
        /* ignore */
      }

      setUserEditing(null);
      setUserModules([]);
      setUserBaseline(null);
      teacherDefaultsRef.current = new Map();
      qc.invalidateQueries({ queryKey: ["permissions"], exact: false });
    } finally {
      setUserSaving(false);
    }
  };

  const setAction = (code: string, key: MatrixAction, value: boolean) => {
    setModules((prev) =>
      prev.map((row) => {
        const actions = row.actions ?? {};
        return row.code === code && typeof actions[key] === "boolean"
          ? { ...row, actions: { ...actions, [key]: value } }
          : row;
      }),
    );
  };

  const toggleRowAll = (row: PermissionMatrixModule) => {
    const next = !allRowEnabled(row);
    setModules((prev) =>
      prev.map((item) => {
        if (item.code !== row.code) return item;
        const actions = { ...(item.actions ?? {}) };
        for (const { key } of MATRIX_ACTIONS) {
          if (typeof actions[key] === "boolean") actions[key] = next;
        }
        return { ...item, actions };
      }),
    );
  };

  const grantAll = () => {
    setModules((prev) =>
      prev.map((row) => {
        const actions = { ...(row.actions ?? {}) };
        for (const { key } of MATRIX_ACTIONS) {
          if (typeof actions[key] === "boolean") actions[key] = true;
        }
        return { ...row, actions };
      }),
    );
  };

  const revokeAll = () => {
    setModules((prev) =>
      prev.map((row) => {
        const actions = { ...(row.actions ?? {}) };
        for (const { key } of MATRIX_ACTIONS) {
          if (typeof actions[key] === "boolean") actions[key] = false;
        }
        return { ...row, actions };
      }),
    );
  };

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    // Re-attach hidden modules so saving the visible matrix does not wipe them.
    const result = await saveRolePermissionMatrix(editing.name, [
      ...modules,
      ...roleHiddenModulesRef.current,
    ]);
    setSaving(false);
    if (!result.data) {
      toast.error(result.error || "Could not save permissions");
      return;
    }
    const { visible, hidden } = partitionMatrixModules(result.data.modules || []);
    roleHiddenModulesRef.current = hidden;
    setModules(visible);
    toast.success("Permissions saved");
    try {
      localStorage.setItem(PERMISSION_REFRESH_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    qc.invalidateQueries({ queryKey: ["permissions"], exact: false });
    setEditing(null);
  };

  if (!isAdmin) {
    return (
      <div className="p-6">
        <Card className="max-w-xl border-border/60">
          <CardContent className="p-6">
            <h1 className="text-lg font-semibold">403 - Unauthorized</h1>
            <p className="mt-2 text-sm text-muted-foreground">Admin access required.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Roles & Permissions"
        subtitle="Assign Create, View, Edit, and Delete access for the Teacher role, or override permissions for individual teachers."
      />

      <Card className="mt-6 border-border/60">
        <CardContent className="p-4 sm:p-5">
          {rolesLoading ? (
            <p className="text-sm text-muted-foreground">Loading roles…</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Role</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-[120px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleRoles.map((row) => (
                    <TableRow key={row.name}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {row.name}
                          {!row.role ? <Badge variant="secondary">Missing</Badge> : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{row.description}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" onClick={() => void openEdit(row)}>
                          <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6 border-border/60">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold">Manage Individual Teacher Permissions</p>
            <p className="text-xs text-muted-foreground">Override Teacher role permissions per individual teacher.</p>
          </div>

          {teachersLoading ? (
            <p className="mt-4 text-sm text-muted-foreground">Loading teachers…</p>
          ) : (
            <div className="mt-4">
              <Input
                value={teacherQuery}
                onChange={(e) => setTeacherQuery(e.target.value)}
                placeholder="Search by name or email"
              />

              <div className="mt-3 max-h-[280px] overflow-auto rounded-md border border-border/60 p-2">
                {filteredTeachers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No teachers found.</p>
                ) : (
                  filteredTeachers.slice(0, 50).map((t) => {
                    const userId = getTeacherUserId(t);
                    const name = getTeacherDisplayName(t);
                    const email = ((t as any).user?.email as string | undefined) || "—";
                    const selected = userEditing?.userId === userId;
                    return (
                      <div
                        key={String(userId ?? (t as any).id ?? name)}
                        className="flex items-center justify-between gap-3 py-2 px-1"
                      >
                        <div>
                          <p className={cn("text-sm font-medium", selected && "text-primary")}>{name}</p>
                          <p className="text-xs text-muted-foreground">{email}</p>
                        </div>
                        <Button
                          size="sm"
                          variant={selected ? "secondary" : "outline"}
                          onClick={() => void openUserEdit(t)}
                          disabled={!userId}
                        >
                          Edit
                        </Button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="flex max-h-[90vh] w-[calc(100vw-1.5rem)] max-w-4xl flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>Edit Role: {editing?.name}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold">Permission Matrix</p>
              <p className="text-xs text-muted-foreground">
                Enabled: {enabled} / {total}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={grantAll} disabled={matrixLoading}>
                Grant All
              </Button>
              <Button size="sm" variant="outline" onClick={revokeAll} disabled={matrixLoading}>
                Revoke All
              </Button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto rounded-md border border-border/60">
            {matrixLoading ? (
              <p className="p-4 text-sm text-muted-foreground">Loading permission matrix…</p>
            ) : modules.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No permissions returned for this role.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[220px]">Module</TableHead>
                    {MATRIX_ACTIONS.map((col) => (
                      <TableHead key={col.key} className="w-[88px] text-center">
                        {col.label}
                      </TableHead>
                    ))}
                    <TableHead className="w-[88px] text-center">All</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {modules.map((row) => (
                    <TableRow key={row.code}>
                      <TableCell>
                        <p className="font-medium">{row.name}</p>
                        <p className="text-xs text-muted-foreground">{row.description}</p>
                      </TableCell>
                      {MATRIX_ACTIONS.map((col) => {
                        const actionValue = row.actions?.[col.key];
                        return (
                          <TableCell key={col.key} className="text-center">
                            {typeof actionValue === "boolean" ? (
                              <CircleToggle
                                checked={actionValue}
                                label={`${row.name} ${col.label}`}
                                onToggle={() => setAction(row.code, col.key, !actionValue)}
                              />
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-center">
                        <CircleToggle
                          checked={allRowEnabled(row)}
                          label={`${row.name} all`}
                          onToggle={() => toggleRowAll(row)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" disabled={saving} onClick={closeModal}>
              Cancel
            </Button>
            <Button className="btn-highlight" disabled={saving || matrixLoading} onClick={() => void save()}>
              {saving ? "Saving…" : "Save Permissions"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!userEditing} onOpenChange={(open) => !open && closeUserModal()}>
        <DialogContent className="flex max-h-[90vh] w-[calc(100vw-1.5rem)] max-w-4xl flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>Edit Permissions: {userEditing?.name}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold">Permission Matrix</p>
              <p className="text-xs text-muted-foreground">
                Enabled: {userEnabled} / {userTotal}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={grantAllUser} disabled={userMatrixLoading}>
                Grant All
              </Button>
              <Button size="sm" variant="outline" onClick={revokeAllUser} disabled={userMatrixLoading}>
                Revoke All
              </Button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto rounded-md border border-border/60">
            {userMatrixLoading ? (
              <p className="p-4 text-sm text-muted-foreground">Loading permission matrix…</p>
            ) : userModules.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No permissions returned for this teacher.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[220px]">Module</TableHead>
                    {MATRIX_ACTIONS.map((col) => (
                      <TableHead key={col.key} className="w-[88px] text-center">
                        {col.label}
                      </TableHead>
                    ))}
                    <TableHead className="w-[88px] text-center">All</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {userModules.map((row) => (
                    <TableRow key={row.code}>
                      <TableCell>
                        <p className="font-medium">{row.name}</p>
                        <p className="text-xs text-muted-foreground">{row.description}</p>
                      </TableCell>
                      {MATRIX_ACTIONS.map((col) => {
                        const actionValue = row.actions?.[col.key];
                        const overridden = Boolean(row.overridden?.[col.key]);
                        return (
                          <TableCell key={col.key} className="text-center">
                            {typeof actionValue === "boolean" ? (
                              <div className="mx-auto flex items-center justify-center gap-1">
                                <CircleToggle
                                  checked={actionValue}
                                  overridden={overridden}
                                  label={`${row.name} ${col.label}`}
                                  onToggle={() => setUserAction(row.code, col.key, !actionValue)}
                                />
                                {overridden ? (
                                  <button
                                    type="button"
                                    aria-label={`Revert ${row.name} ${col.label} to inherit from role`}
                                    onClick={() => revertUserAction(row.code, col.key)}
                                    className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                                  >
                                    <RotateCcw className="h-3 w-3" />
                                  </button>
                                ) : null}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-center">
                        <CircleToggle
                          checked={allRowEnabled(row)}
                          label={`${row.name} all`}
                          onToggle={() => toggleRowAllUser(row)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" disabled={userSaving} onClick={closeUserModal}>
              Cancel
            </Button>
            <Button
              className="btn-highlight"
              disabled={userSaving || userMatrixLoading || !userDirty}
              onClick={() => void saveUser()}
            >
              {userSaving ? "Saving…" : "Save Overrides"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
