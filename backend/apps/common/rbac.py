"""
RBAC helpers backed by ``apps.roles`` (Role/Permission/UserRole).

This is the single source of truth for "does this user have permission X?"
and is intended to be used by DRF permission classes across the codebase.
"""

from __future__ import annotations

from typing import Mapping

from django.db.models import Q

from apps.common.permissions import ROLE_ADMIN, ROLE_STAFF, user_has_role
from apps.roles.models import Permission as RbacPermission
from apps.roles.models import Role as RbacRole
from apps.roles.models import UserRole as RbacUserRole
from apps.roles.models import UserPermissionOverride


ACCOUNT_ROLE_TO_RBAC_ROLE_NAME = {
    # accounts.User.role values
    "ADMIN": "Admin",
    "TEACHER": "Teacher",
    "STUDENT": "Student",
}


def _effective_roles_for_user(user) -> list[RbacRole]:
    """
    Resolve RBAC roles for the user.

    Priority:
    1. Explicit ``UserRole`` rows.
    2. Fallback to ``accounts.User.role`` mapping (keeps old behavior working
       until the admin assigns roles explicitly via the RBAC endpoints).
    """
    if not user or not getattr(user, "is_authenticated", False):
        return []

    direct = (
        RbacRole.objects.filter(
            is_active=True,
            user_roles__user=user,
        )
        .distinct()
        .all()
    )
    if direct:
        return list(direct)

    account_role = getattr(user, "role", None)
    if not account_role:
        return []
    rbac_role_name = ACCOUNT_ROLE_TO_RBAC_ROLE_NAME.get(str(account_role).upper())
    if not rbac_role_name:
        return []

    role = RbacRole.objects.filter(name=rbac_role_name, is_active=True).first()
    return [role] if role else []


def effective_roles_for_user(user) -> list[RbacRole]:
    """Public wrapper around the internal role resolution helper."""
    return _effective_roles_for_user(user)


def user_has_rbac_permission(user, codename: str) -> bool:
    """
    Returns True when the user has the RBAC permission codename.

    Admin/staff always bypass RBAC checks.
    """
    if user_has_role(user, ROLE_ADMIN, ROLE_STAFF):
        return True

    if not codename:
        return False

    # Per-user override for CRUD permissions (view/create/update/delete).
    # For other permissions like `analytics.view_dashboard`, do not apply overrides.
    if "." in codename:
        module, action = codename.split(".", 1)
        override_field_by_action = {
            "view": "can_view",
            "create": "can_create",
            "update": "can_edit",
            "delete": "can_delete",
        }
        override_field = override_field_by_action.get(action)
        if override_field:
            override = (
                UserPermissionOverride.objects.filter(user=user, module=module).first()
            )
            if override is not None:
                value = getattr(override, override_field)
                if value is not None:
                    return bool(value)

    roles = _effective_roles_for_user(user)
    if not roles:
        return False

    return RbacPermission.objects.filter(
        codename=codename,
        roles__in=roles,
    ).exists()


def resolve_permission_codename(
    *,
    module: str,
    view,
    request,
    action_overrides: Mapping[str, str] | None = None,
) -> str:
    """
    Convert a DRF request into a permission codename (``module.action``).

    This keeps permission mapping consistent across all modules.
    """
    module = str(module).strip()
    action = getattr(view, "action", None)

    if action_overrides and action in action_overrides:
        return str(action_overrides[action])

    # Safe methods → module.view
    if request.method in ("GET", "HEAD", "OPTIONS"):
        return f"{module}.view"

    # Explicit DRF actions → CRUD mapping
    if action in ("create",):
        return f"{module}.create"
    if action in ("update", "partial_update"):
        return f"{module}.update"
    if action in ("destroy",):
        return f"{module}.delete"

    # Common custom write actions (publish/close/etc.) map to update.
    return f"{module}.update"

