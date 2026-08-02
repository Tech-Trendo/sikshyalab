"""
Role-based permissions for the courses app.
"""

from rest_framework.permissions import SAFE_METHODS, BasePermission

from apps.common.permissions import (
    ROLE_ADMIN,
    ROLE_STAFF,
    ROLE_TEACHER,
    user_has_role,
)


class IsAdminOrReadOnlyCourse(BasePermission):
    """
    - Admin: full CRUD
    - Teacher: read all; write courses they instruct (or create if admin only)
    - Authenticated: read published courses
    """

    message = "You do not have permission to modify courses."

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user_has_role(user, ROLE_ADMIN, ROLE_STAFF):
            return True
        if user_has_role(user, ROLE_TEACHER):
            # Teachers may update assigned courses; create reserved for admin
            return view.action in ("update", "partial_update")
        return False

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            user = request.user
            if user and user.is_authenticated and user_has_role(
                user, ROLE_TEACHER, ROLE_ADMIN, ROLE_STAFF
            ):
                return True
            return bool(getattr(obj, "is_published", True))
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user_has_role(user, ROLE_ADMIN, ROLE_STAFF):
            return True
        if user_has_role(user, ROLE_TEACHER):
            course = obj if hasattr(obj, "instructors") else getattr(obj, "course", None)
            if course is None:
                return False
            return course.instructors.filter(teacher__user=user).exists()
        return False


class IsAdminOrReadOnlyCategory(BasePermission):
    """Categories: admin write; public read."""

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        user = request.user
        if not user or not user.is_authenticated:
            return False
        return user_has_role(user, ROLE_ADMIN, ROLE_STAFF)
