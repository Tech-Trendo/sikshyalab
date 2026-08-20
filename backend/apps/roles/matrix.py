"""
Permission-matrix adapter over the existing Role ↔ Permission M2M.

Does not introduce a second permission table. CRUD flags map to:
  can_view   → {module}.view
  can_create → {module}.create
  can_edit   → {module}.update
  can_delete → {module}.delete
"""

from __future__ import annotations

from apps.common.permissions import ROLE_ADMIN, ROLE_STAFF, user_has_role
from apps.common.rbac import effective_roles_for_user
from apps.roles.models import Permission, Role
from apps.roles.models import UserPermissionOverride

# URL slug → Role.name (system roles). Admin is not editable via this UI.
ROLE_SLUGS = {
    "teacher": "Teacher",
    "student": "Student",
}

CRUD_FLAG_TO_ACTION = {
    "can_view": "view",
    "can_create": "create",
    "can_edit": "update",
    "can_delete": "delete",
}

CRUD_FIELDS = tuple(CRUD_FLAG_TO_ACTION.keys())


def coerce_bool_or_null(value) -> bool | None:
    """Normalize API/client values to bool or None (inherit from role)."""
    if value is None:
        return None
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in ("true", "1", "yes"):
            return True
        if normalized in ("false", "0", "no"):
            return False
        if normalized in ("null", "none", ""):
            return None
    if isinstance(value, (int, float)) and value in (0, 1):
        return bool(value)
    raise ValueError("Expected boolean or null.")


def extract_modules_payload(data) -> list | None:
    """
    Accept PATCH bodies as:
      [ {...}, ... ]                     (array sent as root JSON — common client mistake)
      { "modules": [...] }
      { "data": { "modules": [...] } }  (accidental envelope replay)
      { "user_id": ..., "role": ..., "modules": [...] }  (GET response replay)
    """
    if isinstance(data, list):
        return data
    if not isinstance(data, dict):
        return None
    modules = data.get("modules")
    if isinstance(modules, list):
        return modules
    if isinstance(modules, dict):
        return [modules]
    nested = data.get("data")
    if isinstance(nested, dict):
        nested_modules = nested.get("modules")
        if isinstance(nested_modules, list):
            return nested_modules
        if isinstance(nested_modules, dict):
            return [nested_modules]
    return None

MODULE_LABELS = {
    "accounts": "Users & Accounts",
    "roles": "Roles & Permissions",
    "students": "Students",
    "teachers": "Teachers",
    "courses": "Courses",
    "content": "Curriculum",
    "batches": "Classes / Batches",
    "enrollments": "Enrollments",
    "fees": "Fees",
    "assignments": "Assignments",
    "certificates": "Certificates",
    "cms": "CMS",
    "seo": "SEO",
    "notifications": "Notifications",
    "analytics": "Dashboard",
    "common": "Settings",
}


def resolve_matrix_role(role_slug: str) -> Role | None:
    name = ROLE_SLUGS.get(str(role_slug or "").strip().lower())
    if not name:
        return None
    return Role.objects.filter(name__iexact=name, is_active=True).first()


def _modules() -> list[str]:
    modules = list(
        Permission.objects.order_by("module").values_list("module", flat=True).distinct()
    )
    preferred = [m for m in MODULE_LABELS if m in modules]
    extras = [m for m in modules if m not in MODULE_LABELS]
    return preferred + extras


def build_permission_matrix(role: Role) -> dict:
    granted = set(role.permissions.values_list("codename", flat=True))
    rows = []
    for module in _modules():
        rows.append(
            {
                "module": module,
                "label": MODULE_LABELS.get(module, module.replace("_", " ").title()),
                "can_view": f"{module}.view" in granted,
                "can_create": f"{module}.create" in granted,
                "can_edit": f"{module}.update" in granted,
                "can_delete": f"{module}.delete" in granted,
            }
        )
    return {
        "role": role.name,
        "modules": rows,
    }


def apply_permission_matrix(role: Role, modules: list[dict]) -> dict:
    """
    Update CRUD flags for the given modules. Extra permissions
    (e.g. assignments.grade) are left unchanged.
    """
    current = set(role.permissions.values_list("id", flat=True))
    to_add: set[int] = set()
    to_remove: set[int] = set()

    for row in modules:
        module = str(row.get("module") or "").strip()
        if not module:
            continue
        for flag, action in CRUD_FLAG_TO_ACTION.items():
            if flag not in row:
                continue
            enabled = bool(row[flag])
            perm = Permission.objects.filter(codename=f"{module}.{action}").first()
            if perm is None:
                continue
            if enabled:
                to_add.add(perm.id)
            else:
                to_remove.add(perm.id)

    updated = (current | to_add) - to_remove
    role.permissions.set(updated)
    return build_permission_matrix(role)


def build_effective_permission_matrix(user) -> dict:
    """
    Build a permission matrix for a specific user.

    Resolution order for each CRUD permission:
      1) UserPermissionOverride field (if non-null)
      2) Role default (Role ↔ Permission M2M)

    Returns per-field override indicators so the frontend can highlight
    which values are inherited vs explicitly overridden.
    """

    modules = _modules()

    override_rows = UserPermissionOverride.objects.filter(user=user, module__in=modules)
    overrides_by_module = {o.module: o for o in override_rows}

    crud_codename_set: set[str] = set()
    for module in modules:
        crud_codename_set.update(
            {
                f"{module}.view",
                f"{module}.create",
                f"{module}.update",
                f"{module}.delete",
            }
        )

    # Admin/staff bypass RBAC checks, so their role defaults are effectively "all on".
    if user_has_role(user, ROLE_ADMIN, ROLE_STAFF):
        granted = crud_codename_set
    else:
        roles = effective_roles_for_user(user)
        granted = set(
            Permission.objects.filter(codename__in=crud_codename_set, roles__in=roles)
            .values_list("codename", flat=True)
            .distinct()
        )

    role_name = str(getattr(user, "role", "") or "").upper()
    role_display = {"ADMIN": "Admin", "TEACHER": "Teacher", "STUDENT": "Student"}.get(
        role_name, role_name
    )

    rows = []
    for module in modules:
        override = overrides_by_module.get(module)

        def pick(field: str, default: bool):
            if override is None:
                return default, False
            val = getattr(override, field)
            if val is None:
                return default, False
            return bool(val), True

        can_view, can_view_is_override = pick(
            "can_view", f"{module}.view" in granted
        )
        can_create, can_create_is_override = pick(
            "can_create", f"{module}.create" in granted
        )
        can_edit, can_edit_is_override = pick(
            "can_edit", f"{module}.update" in granted
        )
        can_delete, can_delete_is_override = pick(
            "can_delete", f"{module}.delete" in granted
        )

        rows.append(
            {
                "module": module,
                "label": MODULE_LABELS.get(module, module.replace("_", " ").title()),
                "can_view": can_view,
                "can_create": can_create,
                "can_edit": can_edit,
                "can_delete": can_delete,
                "can_view_is_override": can_view_is_override,
                "can_create_is_override": can_create_is_override,
                "can_edit_is_override": can_edit_is_override,
                "can_delete_is_override": can_delete_is_override,
            }
        )

    return {"user_id": user.pk, "role": role_display, "modules": rows}
