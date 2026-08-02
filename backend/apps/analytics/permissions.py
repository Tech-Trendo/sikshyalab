"""Permissions for analytics endpoints."""

from rest_framework.permissions import BasePermission

from apps.common.permissions import (
    ROLE_ADMIN,
    ROLE_STAFF,
    ROLE_STUDENT,
    ROLE_TEACHER,
    user_has_role,
)


class IsAdminOrTeacherAnalytics(BasePermission):
    """Admins see all analytics; teachers see scoped (own) analytics."""

    message = "Admin or teacher privileges required for analytics."

    def has_permission(self, request, view):
        return user_has_role(request.user, ROLE_ADMIN, ROLE_STAFF, ROLE_TEACHER)


class IsDashboardUser(BasePermission):
    """Admin, teacher, or student may access role-aware dashboard KPIs."""

    message = "Authentication with a dashboard role is required."

    def has_permission(self, request, view):
        return user_has_role(
            request.user, ROLE_ADMIN, ROLE_STAFF, ROLE_TEACHER, ROLE_STUDENT
        )


class IsAdminAnalytics(BasePermission):
    """Strict admin-only analytics."""

    message = "Admin privileges required."

    def has_permission(self, request, view):
        return user_has_role(request.user, ROLE_ADMIN, ROLE_STAFF)


class IsTeacherDashboard(BasePermission):
    """Teacher-only dashboard summary."""

    message = "Teacher privileges required."

    def has_permission(self, request, view):
        return user_has_role(request.user, ROLE_TEACHER)


class IsStudentDashboard(BasePermission):
    """Student-only dashboard summary."""

    message = "Student privileges required."

    def has_permission(self, request, view):
        return user_has_role(request.user, ROLE_STUDENT)
