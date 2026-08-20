"""
Role-based permissions for the teachers app.
"""

from rest_framework.permissions import SAFE_METHODS, BasePermission

from apps.common.permissions import (
    ROLE_ADMIN,
    ROLE_STAFF,
    ROLE_TEACHER,
    user_has_role,
)
from apps.common.rbac import resolve_permission_codename, user_has_rbac_permission


class IsAdminOrTeacherOwn(BasePermission):
    """
    - Admin: full access
    - Teacher: manage own profile and related resources
    - Others: read-only list/retrieve of teachers (authenticated)
    """

    message = "You do not have permission to manage this teacher resource."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user_has_role(user, ROLE_ADMIN, ROLE_STAFF):
            return True
        if user_has_role(user, ROLE_TEACHER):
            required = resolve_permission_codename(
                module="teachers",
                view=view,
                request=request,
            )
            return user_has_rbac_permission(user, required)
        return request.method in SAFE_METHODS

    def has_object_permission(self, request, view, obj):
        user = request.user
        if user_has_role(user, ROLE_ADMIN, ROLE_STAFF):
            return True

        teacher = obj if hasattr(obj, "teacher_id") and hasattr(obj, "user") else getattr(obj, "teacher", None)
        if teacher is None and hasattr(obj, "user"):
            teacher = obj

        if user_has_role(user, ROLE_TEACHER):
            owner = getattr(teacher, "user", None)
            if owner == user:
                return True
            return request.method in SAFE_METHODS

        return request.method in SAFE_METHODS


class IsAdminOrTeacherOwnRelated(BasePermission):
    """Admin full; teachers CRUD only on their own related records."""

    message = "You can only manage your own teacher records."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user_has_role(user, ROLE_ADMIN, ROLE_STAFF, ROLE_TEACHER):
            return True
        if user_has_role(user, ROLE_TEACHER):
            required = resolve_permission_codename(
                module="teachers",
                view=view,
                request=request,
            )
            return user_has_rbac_permission(user, required)
        return request.method in SAFE_METHODS

    def has_object_permission(self, request, view, obj):
        user = request.user
        if user_has_role(user, ROLE_ADMIN, ROLE_STAFF):
            return True
        if user_has_role(user, ROLE_TEACHER):
            teacher = getattr(obj, "teacher", None)
            if teacher is not None and teacher.user_id == user.id:
                return True
            return request.method in SAFE_METHODS
        return request.method in SAFE_METHODS
