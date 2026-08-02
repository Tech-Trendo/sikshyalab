"""
Role-based and ownership permissions for ShikshaLab.
"""

from rest_framework.permissions import SAFE_METHODS, BasePermission


# Canonical role codes used across the platform
# Matches accounts.User.Role values (ADMIN/TEACHER/STUDENT) plus lowercase aliases
ROLE_ADMIN = "admin"
ROLE_TEACHER = "teacher"
ROLE_STUDENT = "student"
ROLE_STAFF = "staff"


def _normalize_role(value):
    if value is None:
        return None
    if isinstance(value, str):
        return value.strip().lower()
    for attr in ("code", "name", "slug"):
        if hasattr(value, attr):
            raw = getattr(value, attr)
            if raw:
                return str(raw).strip().lower()
    return str(value).strip().lower()


def get_user_roles(user):
    """
    Collect role codes for a user.

    Supports:
    - user.role (string or related object with code/name/slug)
    - user.roles (M2M / related manager)
    - user.is_superuser / user.is_staff
    """
    if not user or not getattr(user, "is_authenticated", False):
        return set()

    roles = set()

    if getattr(user, "is_superuser", False):
        roles.add(ROLE_ADMIN)

    if getattr(user, "is_staff", False):
        roles.add(ROLE_STAFF)
        roles.add(ROLE_ADMIN)

    # Honour convenience properties on accounts.User
    if getattr(user, "is_admin", False) is True:
        roles.add(ROLE_ADMIN)
    if getattr(user, "is_teacher", False) is True:
        roles.add(ROLE_TEACHER)
    if getattr(user, "is_student", False) is True:
        roles.add(ROLE_STUDENT)

    role_attr = getattr(user, "role", None)
    if role_attr is not None:
        if hasattr(role_attr, "all") and callable(role_attr.all):
            for item in role_attr.all():
                normalized = _normalize_role(item)
                if normalized:
                    roles.add(normalized)
        else:
            normalized = _normalize_role(role_attr)
            if normalized:
                roles.add(normalized)

    roles_attr = getattr(user, "roles", None)
    if roles_attr is not None and hasattr(roles_attr, "all"):
        for item in roles_attr.all():
            normalized = _normalize_role(item)
            if normalized:
                roles.add(normalized)

    return roles


def user_has_role(user, *allowed):
    allowed_set = {_normalize_role(r) for r in allowed if r}
    return bool(get_user_roles(user) & allowed_set)


class IsAdmin(BasePermission):
    """Allow access only to admin / staff / superuser."""

    message = "Admin privileges required."

    def has_permission(self, request, view):
        return user_has_role(request.user, ROLE_ADMIN, ROLE_STAFF)


class IsTeacher(BasePermission):
    """Allow access only to teachers (and admins)."""

    message = "Teacher privileges required."

    def has_permission(self, request, view):
        return user_has_role(request.user, ROLE_TEACHER, ROLE_ADMIN, ROLE_STAFF)


class IsStudent(BasePermission):
    """Allow access only to students (and admins)."""

    message = "Student privileges required."

    def has_permission(self, request, view):
        return user_has_role(request.user, ROLE_STUDENT, ROLE_ADMIN, ROLE_STAFF)


class IsAdminOrReadOnly(BasePermission):
    """Read for authenticated users; write for admins only."""

    message = "Admin privileges required for write operations."

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return bool(request.user and request.user.is_authenticated)
        return user_has_role(request.user, ROLE_ADMIN, ROLE_STAFF)


class RolePermission(BasePermission):
    """
    Generic role gate.

    Views may declare ``allowed_roles = ['admin', 'teacher']``.
    Falls back to denying if none are declared.
    """

    message = "You do not have the required role."

    def has_permission(self, request, view):
        allowed = getattr(view, "allowed_roles", None)
        if not allowed:
            return False
        return user_has_role(request.user, *allowed)


class IsOwnerOrAdmin(BasePermission):
    """
    Object-level: owner or admin.

    Looks for ownership on ``obj.user``, ``obj.owner``, or ``obj.created_by``.
    Views may set ``owner_field`` to customise the attribute name.
    """

    message = "You must be the owner or an admin."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        if user_has_role(request.user, ROLE_ADMIN, ROLE_STAFF):
            return True

        owner_field = getattr(view, "owner_field", None)
        candidates = []
        if owner_field:
            candidates.append(owner_field)
        candidates.extend(["user", "owner", "created_by", "student", "teacher"])

        for field in candidates:
            owner = getattr(obj, field, None)
            if owner is None:
                continue
            if owner == request.user:
                return True
            nested_user = getattr(owner, "user", None)
            if nested_user is not None and nested_user == request.user:
                return True
            if hasattr(owner, "pk") and hasattr(request.user, "pk"):
                if owner.pk == request.user.pk:
                    return True

        return False
