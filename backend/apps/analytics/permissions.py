"""Permissions for analytics endpoints."""

from rest_framework.permissions import BasePermission

from apps.common.permissions import (
    ROLE_ADMIN,
    ROLE_STAFF,
    ROLE_STUDENT,
    ROLE_TEACHER,
    user_has_role,
)
from apps.common.rbac import user_has_rbac_permission, resolve_permission_codename


class IsAdminOrTeacherAnalytics(BasePermission):
    """Admins see all analytics; teachers see scoped (own) analytics."""

    message = "Admin or teacher privileges required for analytics."

    def has_permission(self, request, view):
        user = request.user
        if user_has_role(user, ROLE_ADMIN, ROLE_STAFF):
            return True
        if user_has_role(user, ROLE_TEACHER):
            required = "analytics.view_dashboard" if getattr(view, "action", None) == "dashboard" else "analytics.view"
            return user_has_rbac_permission(user, required)
        return False


class IsDashboardUser(BasePermission):
    """Admin, teacher, or student may access role-aware dashboard KPIs."""

    message = "Authentication with a dashboard role is required."

    def has_permission(self, request, view):
        user = request.user
        if user_has_role(user, ROLE_ADMIN, ROLE_STAFF):
            return True
        if user_has_role(user, ROLE_TEACHER):
            return user_has_rbac_permission(user, "analytics.view")
        return user_has_role(user, ROLE_STUDENT)


class IsAdminAnalytics(BasePermission):
    """Strict admin-only analytics."""

    message = "Admin privileges required."

    def has_permission(self, request, view):
        return user_has_role(request.user, ROLE_ADMIN, ROLE_STAFF)


class IsTeacherDashboard(BasePermission):
    """Teacher-only dashboard summary."""

    message = "Teacher privileges required."

    def has_permission(self, request, view):
        user = request.user
        return user_has_role(user, ROLE_TEACHER) and user_has_rbac_permission(
            user, "analytics.view_dashboard"
        )


class IsStudentDashboard(BasePermission):
    """Student-only dashboard summary."""

    message = "Student privileges required."

    def has_permission(self, request, view):
        return user_has_role(request.user, ROLE_STUDENT)
